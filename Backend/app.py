import os
import re
import time
from datetime import date
from threading import Lock
from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from decimal import Decimal, InvalidOperation

app = Flask(__name__)
CORS(app)

invoice_number_migration_lock = Lock()
invoice_number_migration_complete = False
invoice_number_migration_last_attempt = 0.0
MIGRATION_RETRY_INTERVAL_SECONDS = 30
payment_schema_migration_complete = False
payment_schema_migration_last_attempt = 0.0

@app.before_request
def log_request_info():
    app.logger.info('Headers: %s', request.headers)
    app.logger.info('Body: %s', request.get_data())

@app.after_request
def log_response_info(response):
    app.logger.info('Response: %s', response.get_data())
    return response


def extract_trailing_number(value):
    match = re.search(r'(\d+)$', value or "")
    return int(match.group(1)) if match else None


def migrate_invoice_number_prefixes(cur):
    cur.execute("SELECT id, invoice_number FROM invoices ORDER BY created_at ASC, id ASC")
    invoices = cur.fetchall()

    used_est_numbers = set()
    next_est_number = 1
    updates = []

    for invoice_id, invoice_number in invoices:
        current_number = invoice_number or ""
        normalized_number = current_number.upper()

        if normalized_number.startswith("EST-"):
            suffix = extract_trailing_number(current_number)
            if suffix is not None and suffix > 0:
                used_est_numbers.add(suffix)
                next_est_number = max(next_est_number, suffix + 1)
            continue

        if not normalized_number.startswith("INV"):
            continue

        suffix = extract_trailing_number(current_number)
        candidate = suffix if suffix is not None and suffix > 0 else next_est_number
        while candidate in used_est_numbers:
            candidate += 1

        used_est_numbers.add(candidate)
        next_est_number = max(next_est_number, candidate + 1)
        new_number = f"EST-{candidate:04d}"

        if new_number != current_number:
            updates.append((new_number, str(invoice_id)))

    if updates:
        cur.executemany(
            "UPDATE invoices SET invoice_number = %s, updated_at = NOW() WHERE id = %s",
            updates
        )

    return len(updates)


def ensure_invoice_number_migration():
    global invoice_number_migration_complete, invoice_number_migration_last_attempt

    if invoice_number_migration_complete:
        return

    now = time.monotonic()
    if now - invoice_number_migration_last_attempt < MIGRATION_RETRY_INTERVAL_SECONDS:
        return

    with invoice_number_migration_lock:
        if invoice_number_migration_complete:
            return

        now = time.monotonic()
        if now - invoice_number_migration_last_attempt < MIGRATION_RETRY_INTERVAL_SECONDS:
            return

        invoice_number_migration_last_attempt = now
        conn = None
        cur = None

        try:
            conn = get_db_connection()
            cur = conn.cursor()
            migrated_count = migrate_invoice_number_prefixes(cur)
            conn.commit()
            invoice_number_migration_complete = True
            app.logger.info("Invoice number migration complete. Updated %s record(s).", migrated_count)
        except Exception as migration_error:
            if conn:
                conn.rollback()
            app.logger.error("Invoice number migration failed: %s", migration_error)
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()


def ensure_customer_payment_schema():
    global payment_schema_migration_complete, payment_schema_migration_last_attempt

    if payment_schema_migration_complete:
        return

    now = time.monotonic()
    if now - payment_schema_migration_last_attempt < MIGRATION_RETRY_INTERVAL_SECONDS:
        return

    with invoice_number_migration_lock:
        if payment_schema_migration_complete:
            return

        now = time.monotonic()
        if now - payment_schema_migration_last_attempt < MIGRATION_RETRY_INTERVAL_SECONDS:
            return

        payment_schema_migration_last_attempt = now
        conn = None
        cur = None

        try:
            conn = get_db_connection()
            cur = conn.cursor()

            cur.execute(
                '''
                CREATE TABLE IF NOT EXISTS customer_payments (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
                    payment_date DATE NOT NULL,
                    note TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                '''
            )
            cur.execute(
                '''
                CREATE TABLE IF NOT EXISTS payment_allocations (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    payment_id UUID NOT NULL REFERENCES customer_payments(id) ON DELETE CASCADE,
                    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
                    allocated_amount NUMERIC(10, 2) NOT NULL CHECK (allocated_amount > 0),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE (payment_id, invoice_id)
                );
                '''
            )

            cur.execute('CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON customer_payments(customer_id);')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id_payment_date ON customer_payments(customer_id, payment_date, created_at);')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON payment_allocations(payment_id);')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice_id ON payment_allocations(invoice_id);')

            # Ensure line item ordering is persisted for invoice detail rendering.
            cur.execute('ALTER TABLE line_items ADD COLUMN IF NOT EXISTS line_order INTEGER;')
            cur.execute(
                '''
                WITH ordered AS (
                    SELECT
                        id,
                        ROW_NUMBER() OVER (PARTITION BY invoice_id ORDER BY ctid ASC) - 1 AS computed_order
                    FROM line_items
                )
                UPDATE line_items li
                SET line_order = ordered.computed_order
                FROM ordered
                WHERE li.id = ordered.id
                  AND (li.line_order IS NULL OR li.line_order <> ordered.computed_order);
                '''
            )
            cur.execute('ALTER TABLE line_items ALTER COLUMN line_order SET DEFAULT 0;')
            cur.execute('UPDATE line_items SET line_order = 0 WHERE line_order IS NULL;')
            cur.execute('ALTER TABLE line_items ALTER COLUMN line_order SET NOT NULL;')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_line_items_invoice_id_line_order ON line_items(invoice_id, line_order, id);')

            cur.execute("SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_customer_payments';")
            has_trigger = cur.fetchone() is not None
            if not has_trigger:
                cur.execute(
                    '''
                    CREATE TRIGGER set_timestamp_customer_payments
                    BEFORE UPDATE ON customer_payments
                    FOR EACH ROW
                    EXECUTE PROCEDURE trigger_set_timestamp();
                    '''
                )

            conn.commit()
            payment_schema_migration_complete = True
            app.logger.info("Customer payment schema migration complete.")
        except Exception as migration_error:
            if conn:
                conn.rollback()
            app.logger.error("Customer payment schema migration failed: %s", migration_error)
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()


@app.before_request
def run_startup_migrations():
    ensure_customer_payment_schema()
    ensure_invoice_number_migration()


# --- Database Connection ---
def get_db_connection():
    conn = psycopg2.connect(
        host=os.environ.get('DB_HOST', 'localhost'),
        database=os.environ.get('DB_NAME', 'postgres'),
        user=os.environ.get('DB_USER', 'postgres'),
        password=os.environ.get('DB_PASSWORD')
    )
    return conn

# --- Error Handling ---
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not Found'}), 404

@app.errorhandler(500)
def internal_error(error):
    app.logger.error('Server Error: %s', error)
    return jsonify({'error': 'Internal Server Error', 'message': str(error)}), 500

# --- API Endpoints ---

# -- Customer Management --

@app.route('/api/customers', methods=['GET'])
def get_customers():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT id, name, phone, created_at, updated_at FROM customers ORDER BY created_at DESC;')
        customers = cur.fetchall()
        cur.close()
        conn.close()

        customer_list = []
        for customer in customers:
            customer_list.append({
                "id": customer[0],
                "name": customer[1],
                "phone": customer[2],
                "created_at": customer[3],
                "updated_at": customer[4]
            })
        return jsonify(customer_list)
    except Exception as e:
        print(e)
        return internal_error(e)

@app.route('/api/customers', methods=['POST'])
def create_customer():
    try:
        data = request.get_json()
        name = data.get('name')
        phone = data.get('phone')

        if not name or not phone:
            return jsonify({'error': 'Missing name or phone'}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('INSERT INTO customers (name, phone) VALUES (%s, %s) RETURNING id;', (name, phone))
        new_customer_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({'id': new_customer_id, 'name': name, 'phone': phone}), 201
    except Exception as e:
        print(e)
        return internal_error(e)


@app.route('/api/customers/<uuid:customer_id>', methods=['PUT'])
def update_customer(customer_id):
    try:
        data = request.get_json()
        name = data.get('name')
        phone = data.get('phone')

        if not name or not phone:
            return jsonify({'error': 'Missing name or phone'}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            'UPDATE customers SET name = %s, phone = %s, updated_at = NOW() WHERE id = %s RETURNING id;',
            (name, phone, str(customer_id))
        )
        updated_customer_id = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if updated_customer_id:
            return jsonify({'id': str(customer_id), 'name': name, 'phone': phone})
        else:
            return jsonify({'error': 'Customer not found'}), 404
    except Exception as e:
        print(e)
        return internal_error(e)

@app.route('/api/customers/<uuid:customer_id>', methods=['DELETE'])
def delete_customer(customer_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('DELETE FROM customers WHERE id = %s RETURNING id;', (str(customer_id),))
        deleted_customer_id = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if deleted_customer_id:
            return jsonify({'message': 'Customer deleted successfully'})
        else:
            return jsonify({'error': 'Customer not found'}), 404
    except Exception as e:
        print(e)
        return internal_error(e)


# -- Item & Price Management --

@app.route('/api/items', methods=['GET'])
def get_items():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT id, name, group_name, price, created_at, updated_at FROM items ORDER BY created_at DESC;')
        items = cur.fetchall()
        cur.close()
        conn.close()

        item_list = []
        for item in items:
            item_list.append({
                "id": item[0],
                "name": item[1],
                "group_name": item[2],
                "price": item[3],
                "created_at": item[4],
                "updated_at": item[5]
            })
        return jsonify(item_list)
    except Exception as e:
        print(e)
        return internal_error(e)

@app.route('/api/items', methods=['POST'])
def create_item():
    try:
        data = request.get_json()
        name = data.get('name')
        group_name = data.get('group_name')
        price = data.get('price')

        if not name or not price:
            return jsonify({'error': 'Missing name or price'}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            'INSERT INTO items (name, group_name, price) VALUES (%s, %s, %s) RETURNING id;',
            (name, group_name, price)
        )
        new_item_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({'id': new_item_id, 'name': name, 'group_name': group_name, 'price': price}), 201
    except Exception as e:
        print(e)
        return internal_error(e)

@app.route('/api/items/<uuid:item_id>', methods=['PUT'])
def update_item(item_id):
    try:
        data = request.get_json()
        name = data.get('name')
        group_name = data.get('group_name')
        price = data.get('price')

        if not name or not price:
            return jsonify({'error': 'Missing name or price'}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            'UPDATE items SET name = %s, group_name = %s, price = %s, updated_at = NOW() WHERE id = %s RETURNING id;',
            (name, group_name, price, str(item_id))
        )
        updated_item_id = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if updated_item_id:
            return jsonify({'id': str(item_id), 'name': name, 'group_name': group_name, 'price': price})
        else:
            return jsonify({'error': 'Item not found'}), 404
    except Exception as e:
        print(e)
        return internal_error(e)


# -- Invoice Management --

def determine_invoice_status(total, amount_paid, unpaid_status='pending'):
    if total <= 0:
        return 'paid'
    if amount_paid <= 0:
        return unpaid_status
    if amount_paid >= total:
        return 'paid'
    return 'partially-paid'

def calculate_invoice_total(line_items):
    return sum((item['quantity'] * item['unitPrice'] for item in line_items), Decimal('0'))

def parse_decimal_amount(value, field_name):
    try:
        amount = Decimal(str(value))
    except (TypeError, ValueError, InvalidOperation):
        return None, f'{field_name} must be a valid number'

    try:
        if amount <= Decimal('0'):
            return None, f'{field_name} must be greater than 0'
    except InvalidOperation:
        return None, f'{field_name} must be a valid number'

    if not amount.is_finite():
        return None, f'{field_name} must be a valid number'

    return amount, None

def get_table_columns(cur, table_name):
    cur.execute(
        '''
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s;
        ''',
        (table_name,)
    )
    return {row[0] for row in cur.fetchall()}

def pick_column(columns, candidates):
    for candidate in candidates:
        if candidate in columns:
            return candidate
    return None

def fetchone_as_dict(cur):
    row = cur.fetchone()
    if not row:
        return None
    return {desc[0]: row[idx] for idx, desc in enumerate(cur.description)}

def fetchall_as_dicts(cur):
    rows = cur.fetchall()
    columns = [desc[0] for desc in cur.description]
    return [{col: row[idx] for idx, col in enumerate(columns)} for row in rows]

def decimal_or_zero(value):
    if value is None:
        return Decimal('0')
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))

def ensure_customer_exists(cur, customer_id):
    cur.execute('SELECT id FROM customers WHERE id = %s;', (str(customer_id),))
    return cur.fetchone() is not None

def resolve_payment_schema(cur):
    customer_payment_columns = get_table_columns(cur, 'customer_payments')
    payment_allocation_columns = get_table_columns(cur, 'payment_allocations')

    if not customer_payment_columns:
        return None, 'customer_payments table is not available'
    if not payment_allocation_columns:
        return None, 'payment_allocations table is not available'

    payment_amount_col = pick_column(customer_payment_columns, ['amount', 'payment_amount'])
    payment_date_col = pick_column(customer_payment_columns, ['payment_date', 'paymentDate', 'paymentdate', 'date'])
    payment_note_col = pick_column(customer_payment_columns, ['note', 'notes', 'remark', 'remarks', 'description'])
    payment_created_col = pick_column(customer_payment_columns, ['created_at', payment_date_col])
    payment_updated_col = pick_column(customer_payment_columns, ['updated_at'])
    allocation_payment_fk_col = pick_column(payment_allocation_columns, ['payment_id', 'customer_payment_id'])
    allocation_amount_col = pick_column(payment_allocation_columns, ['allocated_amount', 'amount_allocated', 'amount'])
    allocation_created_col = pick_column(payment_allocation_columns, ['created_at'])

    if (
        not payment_amount_col
        or not payment_date_col
        or 'customer_id' not in customer_payment_columns
    ):
        return None, 'customer_payments schema is missing required columns'

    if (
        not allocation_payment_fk_col
        or not allocation_amount_col
        or 'invoice_id' not in payment_allocation_columns
    ):
        return None, 'payment_allocations schema is missing required columns'

    return {
        'payment_amount_col': payment_amount_col,
        'payment_date_col': payment_date_col,
        'payment_note_col': payment_note_col,
        'payment_created_col': payment_created_col,
        'payment_updated_col': payment_updated_col,
        'allocation_payment_fk_col': allocation_payment_fk_col,
        'allocation_amount_col': allocation_amount_col,
        'allocation_created_col': allocation_created_col
    }, None

def recompute_customer_allocations(cur, customer_id, schema):
    payment_amount_col = schema['payment_amount_col']
    payment_date_col = schema['payment_date_col']
    payment_created_col = schema['payment_created_col']
    allocation_payment_fk_col = schema['allocation_payment_fk_col']
    allocation_amount_col = schema['allocation_amount_col']

    payment_created_order = f', {payment_created_col} ASC' if payment_created_col else ''
    cur.execute(
        f'''
        SELECT id, {payment_amount_col} AS payment_amount
        FROM customer_payments
        WHERE customer_id = %s
        ORDER BY {payment_date_col} ASC{payment_created_order}, id ASC
        FOR UPDATE;
        ''',
        (str(customer_id),)
    )
    payments = fetchall_as_dicts(cur)

    cur.execute(
        '''
        SELECT id, total, status
        FROM invoices
        WHERE customer_id = %s
        ORDER BY issue_date ASC, created_at ASC, id ASC
        FOR UPDATE;
        ''',
        (str(customer_id),)
    )
    invoices = fetchall_as_dicts(cur)

    cur.execute(
        f'''
        DELETE FROM payment_allocations pa
        USING customer_payments cp
        WHERE pa.{allocation_payment_fk_col} = cp.id
          AND cp.customer_id = %s;
        ''',
        (str(customer_id),)
    )

    invoice_states = []
    for invoice in invoices:
        invoice_states.append({
            'id': invoice['id'],
            'total': decimal_or_zero(invoice['total']),
            'amount_paid': Decimal('0'),
            'unpaid_status': 'draft' if invoice['status'] == 'draft' else 'pending'
        })

    payment_allocated_totals = {}
    payment_unallocated_totals = {}
    invoice_idx = 0

    for payment in payments:
        payment_id = payment['id']
        remaining_amount = decimal_or_zero(payment['payment_amount'])
        payment_allocated_totals[payment_id] = Decimal('0')

        while remaining_amount > Decimal('0') and invoice_idx < len(invoice_states):
            invoice_state = invoice_states[invoice_idx]
            amount_due = invoice_state['total'] - invoice_state['amount_paid']
            if amount_due <= Decimal('0'):
                invoice_idx += 1
                continue

            allocated_amount = min(remaining_amount, amount_due)
            cur.execute(
                f'''
                INSERT INTO payment_allocations ({allocation_payment_fk_col}, invoice_id, {allocation_amount_col})
                VALUES (%s, %s, %s);
                ''',
                (payment_id, invoice_state['id'], allocated_amount)
            )

            invoice_state['amount_paid'] += allocated_amount
            payment_allocated_totals[payment_id] += allocated_amount
            remaining_amount -= allocated_amount

            if invoice_state['amount_paid'] >= invoice_state['total']:
                invoice_idx += 1

        payment_unallocated_totals[payment_id] = remaining_amount

    updated_invoices = []
    for invoice_state in invoice_states:
        new_status = determine_invoice_status(
            invoice_state['total'],
            invoice_state['amount_paid'],
            invoice_state['unpaid_status']
        )
        cur.execute(
            'UPDATE invoices SET amount_paid = %s, status = %s, updated_at = NOW() WHERE id = %s;',
            (invoice_state['amount_paid'], new_status, invoice_state['id'])
        )
        updated_invoices.append({
            "id": invoice_state['id'],
            "status": new_status,
            "amountPaid": invoice_state['amount_paid'],
            "amount_paid": invoice_state['amount_paid']
        })

    total_unallocated_credit = sum(payment_unallocated_totals.values(), Decimal('0'))
    return {
        "updatedInvoices": updated_invoices,
        "paymentAllocatedTotals": payment_allocated_totals,
        "paymentUnallocatedTotals": payment_unallocated_totals,
        "totalUnallocatedCredit": total_unallocated_credit
    }

def fetch_customer_payments_payload(cur, customer_id, schema):
    payment_amount_col = schema['payment_amount_col']
    payment_date_col = schema['payment_date_col']
    payment_note_col = schema['payment_note_col']
    payment_created_col = schema['payment_created_col']
    payment_updated_col = schema['payment_updated_col']
    allocation_payment_fk_col = schema['allocation_payment_fk_col']
    allocation_amount_col = schema['allocation_amount_col']
    allocation_created_col = schema['allocation_created_col']

    note_select = f'cp.{payment_note_col} AS payment_note,' if payment_note_col else 'NULL AS payment_note,'
    payment_created_select = f'cp.{payment_created_col} AS payment_created_at,' if payment_created_col else 'NULL AS payment_created_at,'
    payment_updated_select = f'cp.{payment_updated_col} AS payment_updated_at,' if payment_updated_col else 'NULL AS payment_updated_at,'
    allocation_created_select = f'pa.{allocation_created_col} AS allocation_created_at,' if allocation_created_col else 'NULL AS allocation_created_at,'
    payment_created_order = f', cp.{payment_created_col} DESC' if payment_created_col else ''
    allocation_order = 'allocation_created_at ASC NULLS LAST, pa.id ASC NULLS LAST' if allocation_created_col else 'pa.id ASC NULLS LAST'

    cur.execute(
        f'''
        SELECT
            cp.id AS payment_id,
            cp.customer_id,
            cp.{payment_amount_col} AS payment_amount,
            cp.{payment_date_col} AS payment_date,
            {note_select}
            {payment_created_select}
            {payment_updated_select}
            pa.id AS allocation_id,
            pa.invoice_id,
            pa.{allocation_amount_col} AS allocation_amount,
            {allocation_created_select}
            inv.invoice_number,
            inv.status AS invoice_status
        FROM customer_payments cp
        LEFT JOIN payment_allocations pa ON pa.{allocation_payment_fk_col} = cp.id
        LEFT JOIN invoices inv ON inv.id = pa.invoice_id
        WHERE cp.customer_id = %s
        ORDER BY cp.{payment_date_col} DESC{payment_created_order}, {allocation_order};
        ''',
        (str(customer_id),)
    )
    rows = fetchall_as_dicts(cur)

    payment_map = {}
    ordered_ids = []
    for row in rows:
        payment_id = row['payment_id']
        if payment_id not in payment_map:
            payment_map[payment_id] = {
                "id": payment_id,
                "customerId": row['customer_id'],
                "customer_id": row['customer_id'],
                "amount": row['payment_amount'],
                "paymentDate": row['payment_date'],
                "payment_date": row['payment_date'],
                "note": row['payment_note'],
                "createdAt": row['payment_created_at'],
                "created_at": row['payment_created_at'],
                "updatedAt": row['payment_updated_at'],
                "updated_at": row['payment_updated_at'],
                "allocations": []
            }
            ordered_ids.append(payment_id)

        if row['allocation_id'] is not None:
            payment_map[payment_id]["allocations"].append({
                "id": row['allocation_id'],
                "paymentId": payment_id,
                "payment_id": payment_id,
                "invoiceId": row['invoice_id'],
                "invoice_id": row['invoice_id'],
                "allocatedAmount": row['allocation_amount'],
                "allocated_amount": row['allocation_amount'],
                "invoiceNumber": row['invoice_number'],
                "invoice_number": row['invoice_number'],
                "invoiceStatus": row['invoice_status'],
                "invoice_status": row['invoice_status'],
                "createdAt": row['allocation_created_at'],
                "created_at": row['allocation_created_at']
            })

    payments = []
    total_unallocated_credit = Decimal('0')
    for payment_id in ordered_ids:
        payment = payment_map[payment_id]
        allocated_total = sum(
            (decimal_or_zero(allocation['allocatedAmount']) for allocation in payment['allocations']),
            Decimal('0')
        )
        unallocated_amount = decimal_or_zero(payment['amount']) - allocated_total
        if unallocated_amount < Decimal('0'):
            unallocated_amount = Decimal('0')

        payment['allocatedAmountTotal'] = allocated_total
        payment['allocated_amount_total'] = allocated_total
        payment['unallocatedAmount'] = unallocated_amount
        payment['unallocated_amount'] = unallocated_amount

        total_unallocated_credit += unallocated_amount
        payments.append(payment)

    customer_credit = {
        "totalUnallocated": total_unallocated_credit,
        "total_unallocated": total_unallocated_credit
    }
    return {
        "customerId": str(customer_id),
        "customer_id": str(customer_id),
        "payments": payments,
        "customerCredit": customer_credit,
        "customer_credit": customer_credit
    }

def validate_line_items(line_items):
    if not isinstance(line_items, list) or len(line_items) == 0:
        return None, 'At least one line item is required'

    normalized_items = []
    for item in line_items:
        description = item.get('description')
        quantity = item.get('quantity')
        unit_price = item.get('unitPrice')

        if not description or quantity is None or unit_price is None:
            return None, 'Each line item must include description, quantity, and unitPrice'

        try:
            quantity_value = int(quantity)
            unit_price_value = Decimal(str(unit_price))
        except (TypeError, ValueError, InvalidOperation):
            return None, 'Line item quantity and unitPrice must be valid numbers'

        if quantity_value <= 0:
            return None, 'Line item quantity must be greater than 0'
        if unit_price_value < Decimal('0'):
            return None, 'Line item unitPrice must be 0 or greater'

        normalized_items.append({
            "itemId": item.get('itemId') or item.get('item_id'),
            "description": description,
            "group_name": item.get('group_name'),
            "quantity": quantity_value,
            "unitPrice": unit_price_value
        })

    return normalized_items, None

def fetch_invoice_details(cur, invoice_id):
    cur.execute(
        '''
        SELECT i.id, i.invoice_number, i.customer_id, c.name as customer_name, c.phone as customer_phone,
               i.issue_date, i.status, i.total, i.amount_paid, i.created_at, i.updated_at
        FROM invoices i
        JOIN customers c ON i.customer_id = c.id
        WHERE i.id = %s;
        ''',
        (invoice_id,)
    )
    invoice = cur.fetchone()
    if not invoice:
        return None

    cur.execute(
        '''
        SELECT li.id, li.item_id, li.description, li.group_name, li.quantity, li.unit_price, i.name, li.line_order
        FROM line_items li
        LEFT JOIN items i ON li.item_id = i.id
        WHERE li.invoice_id = %s
        ORDER BY li.line_order ASC, li.id ASC;
        ''',
        (invoice_id,)
    )
    line_items = cur.fetchall()

    return {
        "id": invoice[0],
        "invoiceNumber": invoice[1],
        "invoice_number": invoice[1],
        "customer": {
            "id": invoice[2],
            "name": invoice[3],
            "phone": invoice[4]
        },
        "customerId": invoice[2],
        "issueDate": invoice[5],
        "issue_date": invoice[5],
        "status": invoice[6],
        "total": invoice[7],
        "amountPaid": invoice[8],
        "amount_paid": invoice[8],
        "createdAt": invoice[9],
        "created_at": invoice[9],
        "updatedAt": invoice[10],
        "updated_at": invoice[10],
        "lineItems": [{
            "id": li[0],
            "itemId": li[1],
            "item_id": li[1],
            "description": li[2],
            "group_name": li[3],
            "quantity": li[4],
            "unitPrice": li[5],
            "unit_price": li[5],
            "itemName": li[6],
            "item_name": li[6],
            "lineOrder": li[7],
            "line_order": li[7]
        } for li in line_items]
    }

@app.route('/api/invoices', methods=['GET'])
def get_invoices():
    try:
        customer_id = request.args.get('customerId')
        conn = get_db_connection()
        cur = conn.cursor()
        
        query = '''
            SELECT
                i.id,
                i.invoice_number,
                i.customer_id,
                c.name as customer_name,
                c.phone as customer_phone,
                i.issue_date,
                i.status,
                i.total,
                i.amount_paid,
                i.created_at,
                i.updated_at
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
        '''
        params = []
        if customer_id:
            query += ' WHERE i.customer_id = %s'
            params.append(customer_id)
            
        query += ' ORDER BY i.created_at DESC, i.issue_date DESC, i.id DESC;'
        
        cur.execute(query, tuple(params))
        invoices = cur.fetchall()
        cur.close()
        conn.close()

        invoice_list = []
        for inv in invoices:
            invoice_list.append({
                "id": inv[0],
                "invoiceNumber": inv[1],
                "customer": {
                    "id": inv[2],
                    "name": inv[3],
                    "phone": inv[4]
                },
                "customerId": inv[2],
                "issueDate": inv[5],
                "status": inv[6],
                "total": inv[7],
                "amountPaid": inv[8],
                "createdAt": inv[9],
                "created_at": inv[9],
                "updatedAt": inv[10],
                "updated_at": inv[10]
            })
        print("Invoice List before jsonify:", invoice_list)
        return jsonify(invoice_list)
    except Exception as e:
        print(e)
        return internal_error(e)

@app.route('/api/invoices/<uuid:invoice_id>', methods=['GET'])
def get_invoice_by_id(invoice_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        invoice_details = fetch_invoice_details(cur, str(invoice_id))
        cur.close()
        conn.close()

        if not invoice_details:
            return jsonify({'error': 'Invoice not found'}), 404

        return jsonify(invoice_details)
    except Exception as e:
        print(e)
        return internal_error(e)

def generate_invoice_number(cur):
    cur.execute("SELECT invoice_number FROM invoices ORDER BY created_at DESC LIMIT 1")
    last_invoice = cur.fetchone()
    if last_invoice:
        last_number = extract_trailing_number(last_invoice[0]) or 0
        new_number = last_number + 1
        return f'EST-{new_number:04d}'
    return 'EST-0001'

@app.route('/api/invoices', methods=['POST'])
def create_invoice():
    conn = None
    cur = None
    try:
        data = request.get_json() or {}
        customer_id = data.get('customerId')
        issue_date = data.get('issueDate')
        status = data.get('status', 'pending')
        line_items = data.get('lineItems')

        if not customer_id or not issue_date or not line_items:
            return jsonify({'error': 'Missing required fields'}), 400

        normalized_line_items, validation_error = validate_line_items(line_items)
        if validation_error:
            return jsonify({'error': validation_error}), 400

        total = calculate_invoice_total(normalized_line_items)

        customer_id = str(customer_id)
        conn = get_db_connection()
        cur = conn.cursor()

        # Generate invoice number
        invoice_number = generate_invoice_number(cur)

        # Create invoice
        cur.execute(
            'INSERT INTO invoices (customer_id, issue_date, status, total, invoice_number) VALUES (%s, %s, %s, %s, %s) RETURNING id;',
            (customer_id, issue_date, status, total, invoice_number)
        )
        invoice_id = cur.fetchone()[0]

        # Create line items
        for idx, item in enumerate(normalized_line_items):
            cur.execute(
                '''
                INSERT INTO line_items (invoice_id, item_id, description, group_name, quantity, unit_price, line_order)
                VALUES (%s, %s, %s, %s, %s, %s, %s);
                ''',
                (
                    invoice_id,
                    item.get('itemId'),
                    item['description'],
                    item.get('group_name'),
                    item['quantity'],
                    item['unitPrice'],
                    idx
                )
            )

        payment_schema, schema_error = resolve_payment_schema(cur)
        if schema_error:
            return jsonify({'error': schema_error}), 500
        recompute_customer_allocations(cur, customer_id, payment_schema)

        conn.commit()
        return jsonify({'id': invoice_id, 'invoice_number': invoice_number, 'status': 'Invoice created'}), 201
    except Exception as e:
        if conn:
            conn.rollback()
        print(e)
        return internal_error(e)
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

@app.route('/api/invoices/<uuid:invoice_id>', methods=['PUT'])
def update_invoice(invoice_id):
    conn = None
    cur = None
    try:
        data = request.get_json() or {}
        customer_id = data.get('customerId')
        issue_date = data.get('issueDate')
        line_items = data.get('lineItems')

        if not customer_id or not issue_date or not line_items:
            return jsonify({'error': 'Missing required fields'}), 400

        normalized_line_items, validation_error = validate_line_items(line_items)
        if validation_error:
            return jsonify({'error': validation_error}), 400

        total = calculate_invoice_total(normalized_line_items)
        customer_id = str(customer_id)

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('SELECT customer_id, status FROM invoices WHERE id = %s FOR UPDATE;', (str(invoice_id),))
        existing_invoice = cur.fetchone()
        if not existing_invoice:
            return jsonify({'error': 'Invoice not found'}), 404

        previous_customer_id = str(existing_invoice[0])
        current_status = existing_invoice[1]

        cur.execute(
            '''
            UPDATE invoices
            SET customer_id = %s, issue_date = %s, total = %s, status = %s, updated_at = NOW()
            WHERE id = %s;
            ''',
            (customer_id, issue_date, total, current_status, str(invoice_id))
        )

        cur.execute('DELETE FROM line_items WHERE invoice_id = %s;', (str(invoice_id),))

        for idx, item in enumerate(normalized_line_items):
            cur.execute(
                '''
                INSERT INTO line_items (invoice_id, item_id, description, group_name, quantity, unit_price, line_order)
                VALUES (%s, %s, %s, %s, %s, %s, %s);
                ''',
                (
                    str(invoice_id),
                    item.get('itemId'),
                    item['description'],
                    item.get('group_name'),
                    item['quantity'],
                    item['unitPrice'],
                    idx
                )
            )

        payment_schema, schema_error = resolve_payment_schema(cur)
        if schema_error:
            return jsonify({'error': schema_error}), 500

        recompute_customer_allocations(cur, previous_customer_id, payment_schema)
        if previous_customer_id != customer_id:
            recompute_customer_allocations(cur, customer_id, payment_schema)

        invoice_details = fetch_invoice_details(cur, str(invoice_id))
        conn.commit()
        return jsonify({'status': 'Invoice updated', 'invoice': invoice_details})
    except Exception as e:
        if conn:
            conn.rollback()
        print(e)
        return internal_error(e)
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

@app.route('/api/invoices/<uuid:invoice_id>', methods=['DELETE'])
def delete_invoice(invoice_id):
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('SELECT customer_id FROM invoices WHERE id = %s FOR UPDATE;', (str(invoice_id),))
        existing_invoice = cur.fetchone()
        if not existing_invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        customer_id = str(existing_invoice[0])

        payment_allocation_columns = get_table_columns(cur, 'payment_allocations')
        if payment_allocation_columns and 'invoice_id' in payment_allocation_columns:
            cur.execute('DELETE FROM payment_allocations WHERE invoice_id = %s;', (str(invoice_id),))

        cur.execute('DELETE FROM invoices WHERE id = %s;', (str(invoice_id),))

        payment_schema, schema_error = resolve_payment_schema(cur)
        if schema_error:
            return jsonify({'error': schema_error}), 500
        recompute_result = recompute_customer_allocations(cur, customer_id, payment_schema)

        conn.commit()
        customer_credit = {
            "totalUnallocated": recompute_result['totalUnallocatedCredit'],
            "total_unallocated": recompute_result['totalUnallocatedCredit']
        }
        return jsonify({
            'message': 'Invoice deleted successfully',
            'customerId': customer_id,
            'customer_id': customer_id,
            'customerCredit': customer_credit,
            'customer_credit': customer_credit
        })
    except Exception as e:
        if conn:
            conn.rollback()
        print(e)
        return internal_error(e)
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

@app.route('/api/invoices/<uuid:invoice_id>/payment', methods=['PATCH'])
def update_invoice_payment(invoice_id):
    return jsonify({
        'error': 'Invoice-level payment endpoint has been removed. Use /api/customers/<customer_id>/payments.'
    }), 410

@app.route('/api/customers/<uuid:customer_id>/payments', methods=['POST'])
def create_customer_payment(customer_id):
    conn = None
    cur = None
    try:
        data = request.get_json() or {}
        amount_raw = data.get('amount')
        if amount_raw is None and 'paymentAmount' in data:
            amount_raw = data.get('paymentAmount')
        payment_date_raw = data.get('paymentDate') or data.get('payment_date')
        note = data.get('note') if 'note' in data else None

        if amount_raw is None:
            return jsonify({'error': 'Missing amount'}), 400

        payment_amount, amount_error = parse_decimal_amount(amount_raw, 'amount')
        if amount_error:
            return jsonify({'error': amount_error}), 400

        if payment_date_raw:
            try:
                payment_date = date.fromisoformat(str(payment_date_raw))
            except ValueError:
                return jsonify({'error': 'paymentDate must be a valid date (YYYY-MM-DD)'}), 400
        else:
            payment_date = date.today()

        conn = get_db_connection()
        cur = conn.cursor()

        if not ensure_customer_exists(cur, customer_id):
            return jsonify({'error': 'Customer not found'}), 404

        payment_schema, schema_error = resolve_payment_schema(cur)
        if schema_error:
            return jsonify({'error': schema_error}), 500

        payment_amount_col = payment_schema['payment_amount_col']
        payment_date_col = payment_schema['payment_date_col']
        payment_note_col = payment_schema['payment_note_col']

        if 'note' in data and not payment_note_col:
            return jsonify({'error': 'customer_payments schema does not support note field'}), 400

        insert_columns = ['customer_id', payment_amount_col, payment_date_col]
        insert_values = [str(customer_id), payment_amount, payment_date]
        if payment_note_col and 'note' in data:
            insert_columns.append(payment_note_col)
            insert_values.append(note)

        insert_sql = f'''
            INSERT INTO customer_payments ({", ".join(insert_columns)})
            VALUES ({", ".join(["%s"] * len(insert_columns))})
            RETURNING id;
        '''
        cur.execute(insert_sql, insert_values)
        payment_id = cur.fetchone()[0]

        recompute_result = recompute_customer_allocations(cur, customer_id, payment_schema)
        payload = fetch_customer_payments_payload(cur, customer_id, payment_schema)
        payment_response = next(
            (payment for payment in payload['payments'] if str(payment['id']) == str(payment_id)),
            None
        )

        conn.commit()
        return jsonify({
            'status': 'Payment recorded',
            'payment': payment_response,
            'customerId': payload['customerId'],
            'customer_id': payload['customer_id'],
            'customerCredit': payload['customerCredit'],
            'customer_credit': payload['customer_credit'],
            'updatedInvoices': recompute_result['updatedInvoices']
        }), 201
    except Exception as e:
        if conn:
            conn.rollback()
        print(e)
        return internal_error(e)
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

@app.route('/api/customers/<uuid:customer_id>/payments/<uuid:payment_id>', methods=['PUT'])
def update_customer_payment(customer_id, payment_id):
    conn = None
    cur = None
    try:
        data = request.get_json() or {}
        has_amount = 'amount' in data or 'paymentAmount' in data
        has_payment_date = 'paymentDate' in data or 'payment_date' in data
        has_note = 'note' in data

        if not has_amount and not has_payment_date and not has_note:
            return jsonify({'error': 'Provide at least one of amount, paymentDate, or note'}), 400

        payment_amount = None
        if has_amount:
            amount_input = data.get('amount')
            if amount_input is None and 'paymentAmount' in data:
                amount_input = data.get('paymentAmount')
            payment_amount, amount_error = parse_decimal_amount(amount_input, 'amount')
            if amount_error:
                return jsonify({'error': amount_error}), 400

        payment_date = None
        if has_payment_date:
            payment_date_raw = data.get('paymentDate') if 'paymentDate' in data else data.get('payment_date')
            if payment_date_raw is None:
                return jsonify({'error': 'paymentDate must be a valid date (YYYY-MM-DD)'}), 400
            try:
                payment_date = date.fromisoformat(str(payment_date_raw))
            except ValueError:
                return jsonify({'error': 'paymentDate must be a valid date (YYYY-MM-DD)'}), 400

        conn = get_db_connection()
        cur = conn.cursor()

        if not ensure_customer_exists(cur, customer_id):
            return jsonify({'error': 'Customer not found'}), 404

        payment_schema, schema_error = resolve_payment_schema(cur)
        if schema_error:
            return jsonify({'error': schema_error}), 500

        payment_note_col = payment_schema['payment_note_col']
        payment_amount_col = payment_schema['payment_amount_col']
        payment_date_col = payment_schema['payment_date_col']
        payment_updated_col = payment_schema['payment_updated_col']

        if has_note and not payment_note_col:
            return jsonify({'error': 'customer_payments schema does not support note field'}), 400

        cur.execute(
            '''
            SELECT id
            FROM customer_payments
            WHERE id = %s AND customer_id = %s
            FOR UPDATE;
            ''',
            (str(payment_id), str(customer_id))
        )
        if not cur.fetchone():
            return jsonify({'error': 'Payment not found'}), 404

        set_clauses = []
        set_values = []
        if has_amount:
            set_clauses.append(f'{payment_amount_col} = %s')
            set_values.append(payment_amount)
        if has_payment_date:
            set_clauses.append(f'{payment_date_col} = %s')
            set_values.append(payment_date)
        if has_note:
            set_clauses.append(f'{payment_note_col} = %s')
            set_values.append(data.get('note'))
        if payment_updated_col:
            set_clauses.append(f'{payment_updated_col} = NOW()')

        cur.execute(
            f'''
            UPDATE customer_payments
            SET {", ".join(set_clauses)}
            WHERE id = %s AND customer_id = %s;
            ''',
            set_values + [str(payment_id), str(customer_id)]
        )

        recompute_result = recompute_customer_allocations(cur, customer_id, payment_schema)
        payload = fetch_customer_payments_payload(cur, customer_id, payment_schema)
        payment_response = next(
            (payment for payment in payload['payments'] if str(payment['id']) == str(payment_id)),
            None
        )

        conn.commit()
        return jsonify({
            'status': 'Payment updated',
            'payment': payment_response,
            'customerId': payload['customerId'],
            'customer_id': payload['customer_id'],
            'customerCredit': payload['customerCredit'],
            'customer_credit': payload['customer_credit'],
            'updatedInvoices': recompute_result['updatedInvoices']
        })
    except Exception as e:
        if conn:
            conn.rollback()
        print(e)
        return internal_error(e)
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

@app.route('/api/customers/<uuid:customer_id>/payments/<uuid:payment_id>', methods=['DELETE'])
def delete_customer_payment(customer_id, payment_id):
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        if not ensure_customer_exists(cur, customer_id):
            return jsonify({'error': 'Customer not found'}), 404

        payment_schema, schema_error = resolve_payment_schema(cur)
        if schema_error:
            return jsonify({'error': schema_error}), 500

        allocation_payment_fk_col = payment_schema['allocation_payment_fk_col']
        cur.execute(
            '''
            SELECT id
            FROM customer_payments
            WHERE id = %s AND customer_id = %s
            FOR UPDATE;
            ''',
            (str(payment_id), str(customer_id))
        )
        if not cur.fetchone():
            return jsonify({'error': 'Payment not found'}), 404

        cur.execute(
            f'DELETE FROM payment_allocations WHERE {allocation_payment_fk_col} = %s;',
            (str(payment_id),)
        )
        cur.execute(
            'DELETE FROM customer_payments WHERE id = %s AND customer_id = %s;',
            (str(payment_id), str(customer_id))
        )

        recompute_result = recompute_customer_allocations(cur, customer_id, payment_schema)
        payload = fetch_customer_payments_payload(cur, customer_id, payment_schema)

        conn.commit()
        return jsonify({
            'status': 'Payment deleted',
            'deletedPaymentId': str(payment_id),
            'deleted_payment_id': str(payment_id),
            'customerId': payload['customerId'],
            'customer_id': payload['customer_id'],
            'customerCredit': payload['customerCredit'],
            'customer_credit': payload['customer_credit'],
            'updatedInvoices': recompute_result['updatedInvoices']
        })
    except Exception as e:
        if conn:
            conn.rollback()
        print(e)
        return internal_error(e)
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

@app.route('/api/customers/<uuid:customer_id>/payments', methods=['GET'])
def get_customer_payments(customer_id):
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        if not ensure_customer_exists(cur, customer_id):
            return jsonify({'error': 'Customer not found'}), 404

        payment_schema, schema_error = resolve_payment_schema(cur)
        if schema_error:
            return jsonify({'error': schema_error}), 500

        payload = fetch_customer_payments_payload(cur, customer_id, payment_schema)
        return jsonify(payload)
    except Exception as e:
        print(e)
        return internal_error(e)
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@app.route('/api/items/<uuid:item_id>/history', methods=['GET'])
def get_item_price_history(item_id):
    customer_id = request.args.get('customerId')
    if not customer_id:
        return jsonify({'error': 'Missing customerId parameter'}), 400
        
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT li.unit_price, inv.issue_date, COALESCE(it.name, li.description) AS item_name
            FROM line_items li
            JOIN invoices inv ON li.invoice_id = inv.id
            LEFT JOIN items it ON li.item_id = it.id
            WHERE li.item_id = %s AND inv.customer_id = %s
            ORDER BY inv.issue_date DESC;
        """, (str(item_id), str(customer_id)))
        
        history = cur.fetchall()
        cur.close()
        conn.close()
        
        price_history = [{
            "unitPrice": row[0],
            "unit_price": row[0],
            "issueDate": row[1],
            "issue_date": row[1],
            "itemName": row[2],
            "item_name": row[2]
        } for row in history]
        
        return jsonify(price_history)
    except Exception as e:
        print(e)
        return internal_error(e)

if __name__ == '__main__':
    app.run(debug=True, port=5001)
