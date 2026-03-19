import os
import re
import time
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


@app.before_request
def run_startup_migrations():
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
        SELECT li.id, li.item_id, li.description, li.group_name, li.quantity, li.unit_price, i.name
        FROM line_items li
        LEFT JOIN items i ON li.item_id = i.id
        WHERE li.invoice_id = %s;
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
            "item_name": li[6]
        } for li in line_items]
    }

@app.route('/api/invoices', methods=['GET'])
def get_invoices():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT i.id, i.invoice_number, i.customer_id, c.name as customer_name, c.phone as customer_phone, i.issue_date, i.status, i.total, i.amount_paid FROM invoices i JOIN customers c ON i.customer_id = c.id ORDER BY issue_date DESC;')
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
                "amountPaid": inv[8]
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
    try:
        data = request.get_json()
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
        for item in normalized_line_items:
            cur.execute(
                'INSERT INTO line_items (invoice_id, item_id, description, group_name, quantity, unit_price) VALUES (%s, %s, %s, %s, %s, %s);',
                (invoice_id, item.get('itemId'), item['description'], item.get('group_name'), item['quantity'], item['unitPrice'])
            )

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({'id': invoice_id, 'invoice_number': invoice_number, 'status': 'Invoice created'}), 201
    except Exception as e:
        print(e)
        return internal_error(e)

@app.route('/api/invoices/<uuid:invoice_id>', methods=['PUT'])
def update_invoice(invoice_id):
    try:
        data = request.get_json()
        customer_id = data.get('customerId')
        issue_date = data.get('issueDate')
        line_items = data.get('lineItems')

        if not customer_id or not issue_date or not line_items:
            return jsonify({'error': 'Missing required fields'}), 400

        normalized_line_items, validation_error = validate_line_items(line_items)
        if validation_error:
            return jsonify({'error': validation_error}), 400

        total = calculate_invoice_total(normalized_line_items)

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('SELECT amount_paid, status FROM invoices WHERE id = %s;', (str(invoice_id),))
        existing_invoice = cur.fetchone()
        if not existing_invoice:
            cur.close()
            conn.close()
            return jsonify({'error': 'Invoice not found'}), 404

        current_amount_paid, current_status = existing_invoice
        adjusted_amount_paid = min(current_amount_paid, total)
        unpaid_status = 'draft' if current_status == 'draft' else 'pending'
        new_status = determine_invoice_status(total, adjusted_amount_paid, unpaid_status)

        cur.execute(
            '''
            UPDATE invoices
            SET customer_id = %s, issue_date = %s, total = %s, amount_paid = %s, status = %s, updated_at = NOW()
            WHERE id = %s;
            ''',
            (customer_id, issue_date, total, adjusted_amount_paid, new_status, str(invoice_id))
        )

        cur.execute('DELETE FROM line_items WHERE invoice_id = %s;', (str(invoice_id),))

        for item in normalized_line_items:
            cur.execute(
                '''
                INSERT INTO line_items (invoice_id, item_id, description, group_name, quantity, unit_price)
                VALUES (%s, %s, %s, %s, %s, %s);
                ''',
                (str(invoice_id), item.get('itemId'), item['description'], item.get('group_name'), item['quantity'], item['unitPrice'])
            )

        invoice_details = fetch_invoice_details(cur, str(invoice_id))
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({'status': 'Invoice updated', 'invoice': invoice_details})
    except Exception as e:
        print(e)
        return internal_error(e)

@app.route('/api/invoices/<uuid:invoice_id>', methods=['DELETE'])
def delete_invoice(invoice_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('DELETE FROM invoices WHERE id = %s RETURNING id;', (str(invoice_id),))
        deleted_invoice_id = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if deleted_invoice_id:
            return jsonify({'message': 'Invoice deleted successfully'})
        else:
            return jsonify({'error': 'Invoice not found'}), 404
    except Exception as e:
        print(e)
        return internal_error(e)

@app.route('/api/invoices/<uuid:invoice_id>/payment', methods=['PATCH'])
def update_invoice_payment(invoice_id):
    try:
        data = request.get_json() or {}
        payment_amount = data.get('paymentAmount')
        corrected_amount_paid = data.get('amountPaid')

        if (payment_amount is None and corrected_amount_paid is None) or (payment_amount is not None and corrected_amount_paid is not None):
            return jsonify({'error': 'Provide exactly one of paymentAmount or amountPaid'}), 400

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('SELECT total, amount_paid, status FROM invoices WHERE id = %s;', (str(invoice_id),))
        invoice = cur.fetchone()
        if not invoice:
            cur.close()
            conn.close()
            return jsonify({'error': 'Invoice not found'}), 404

        total, amount_paid, current_status = invoice
        if payment_amount is not None:
            try:
                payment_amount = Decimal(str(payment_amount))
            except (TypeError, ValueError, InvalidOperation):
                cur.close()
                conn.close()
                return jsonify({'error': 'paymentAmount must be a valid number'}), 400

            if payment_amount <= Decimal('0'):
                cur.close()
                conn.close()
                return jsonify({'error': 'paymentAmount must be greater than 0'}), 400

            amount_due = total - amount_paid
            if amount_due <= Decimal('0'):
                cur.close()
                conn.close()
                return jsonify({'error': 'Invoice is already fully paid. Use amountPaid to correct it.'}), 400

            if payment_amount > amount_due:
                cur.close()
                conn.close()
                return jsonify({'error': 'Payment exceeds amount due'}), 400

            new_amount_paid = amount_paid + payment_amount
            success_message = 'Payment recorded'
        else:
            try:
                corrected_amount_paid = Decimal(str(corrected_amount_paid))
            except (TypeError, ValueError, InvalidOperation):
                cur.close()
                conn.close()
                return jsonify({'error': 'amountPaid must be a valid number'}), 400

            if corrected_amount_paid < Decimal('0'):
                cur.close()
                conn.close()
                return jsonify({'error': 'amountPaid cannot be negative'}), 400

            if corrected_amount_paid > total:
                cur.close()
                conn.close()
                return jsonify({'error': 'amountPaid cannot exceed invoice total'}), 400

            new_amount_paid = corrected_amount_paid
            success_message = 'Paid amount updated'

        unpaid_status = 'draft' if current_status == 'draft' else 'pending'
        new_status = determine_invoice_status(total, new_amount_paid, unpaid_status)
        
        cur.execute(
            'UPDATE invoices SET amount_paid = %s, status = %s, updated_at = NOW() WHERE id = %s;',
            (new_amount_paid, new_status, str(invoice_id))
        )

        invoice_details = fetch_invoice_details(cur, str(invoice_id))
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({'status': success_message, 'invoice': invoice_details})
    except Exception as e:
        print(e)
        return internal_error(e)


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
