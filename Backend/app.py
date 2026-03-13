import os
from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2

app = Flask(__name__)
CORS(app)

@app.before_request
def log_request_info():
    app.logger.info('Headers: %s', request.headers)
    app.logger.info('Body: %s', request.get_data())

@app.after_request
def log_response_info(response):
    app.logger.info('Response: %s', response.get_data())
    return response


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
        
        # Fetch invoice details
        cur.execute('SELECT i.id, i.invoice_number, i.customer_id, c.name as customer_name, c.phone as customer_phone, i.issue_date, i.status, i.total, i.amount_paid, i.created_at, i.updated_at FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE i.id = %s;', (str(invoice_id),))
        invoice = cur.fetchone()
        
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404

        # Fetch line items for the invoice
        cur.execute('SELECT li.id, li.description, li.group_name, li.quantity, li.unit_price, i.name FROM line_items li LEFT JOIN items i ON li.item_id = i.id WHERE li.invoice_id = %s;', (str(invoice_id),))
        line_items = cur.fetchall()
        
        cur.close()
        conn.close()

        invoice_details = {
            "id": invoice[0],
            "invoice_number": invoice[1],
            "customer": {
                "id": invoice[2],
                "name": invoice[3],
                "phone": invoice[4]
            },
            "customerId": invoice[2],
            "issue_date": invoice[5],
            "status": invoice[6],
            "total": invoice[7],
            "amountPaid": invoice[8],
            "created_at": invoice[9],
            "updated_at": invoice[10],
            "lineItems": [{
                "id": li[0],
                "description": li[1],
                "group_name": li[2],
                "quantity": li[3],
                "unitPrice": li[4],
                "item_name": li[5]
            } for li in line_items]
        }
        
        return jsonify(invoice_details)
    except Exception as e:
        print(e)
        return internal_error(e)

def generate_invoice_number(cur):
    cur.execute("SELECT invoice_number FROM invoices ORDER BY created_at DESC LIMIT 1")
    last_invoice = cur.fetchone()
    if last_invoice:
        last_number = int(last_invoice[0].split('-')[1])
        new_number = last_number + 1
        return f'INV-{new_number:04d}'
    return 'INV-0001'

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

        total = sum(item['quantity'] * item['unitPrice'] for item in line_items)

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
        for item in line_items:
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
        data = request.get_json()
        payment_amount = data.get('paymentAmount')

        if payment_amount is None:
            return jsonify({'error': 'Missing paymentAmount'}), 400

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute('SELECT total, amount_paid FROM invoices WHERE id = %s;', (str(invoice_id),))
        invoice = cur.fetchone()
        if not invoice:
            cur.close()
            conn.close()
            return jsonify({'error': 'Invoice not found'}), 404

        total, amount_paid = invoice
        new_amount_paid = amount_paid + payment_amount
        
        new_status = 'partially-paid'
        if new_amount_paid >= total:
            new_status = 'paid'
        
        cur.execute(
            'UPDATE invoices SET amount_paid = %s, status = %s, updated_at = NOW() WHERE id = %s;',
            (new_amount_paid, new_status, str(invoice_id))
        )
        
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({'id': str(invoice_id), 'status': new_status, 'amount_paid': new_amount_paid})
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
            SELECT li.unit_price, i.issue_date
            FROM line_items li
            JOIN invoices i ON li.invoice_id = i.id
            WHERE li.item_id = %s AND i.customer_id = %s
            ORDER BY i.issue_date DESC;
        """, (str(item_id), str(customer_id)))
        
        history = cur.fetchall()
        cur.close()
        conn.close()
        
        price_history = [{"unit_price": str(row[0]), "issue_date": row[1]} for row in history]
        
        return jsonify(price_history)
    except Exception as e:
        print(e)
        return internal_error(e)

if __name__ == '__main__':
    app.run(debug=True, port=5001)
