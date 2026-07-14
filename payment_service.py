from flask import Flask, request, jsonify

app = Flask(__name__)

# Mock integration for Stripe/Moyasar
@app.route('/api/pay', methods=['POST'])
def process_payment():
    data = request.json
    amount = data.get('amount', 0)
    report_id = data.get('reportId')
    
    if not amount or not report_id:
        return jsonify({"success": False, "error": "Invalid data"}), 400
        
    print(f"Processing payment of {amount} for report {report_id} via Payment Gateway...")
    
    # Simulate success
    # In reality, this would call Stripe SDK: stripe.Charge.create(...)
    return jsonify({
        "success": True, 
        "transaction_id": "txn_mock_123456789",
        "message": "Payment successful"
    }), 200

if __name__ == '__main__':
    print("Payment Gateway integration service started.")
    # app.run(port=8080)
