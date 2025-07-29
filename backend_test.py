import requests
import sys
import json
from datetime import datetime

class InvoiceVerificationTester:
    def __init__(self, base_url="https://37fb3785-fa5f-4252-bdda-79098e6e3adf.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.created_ids = {
            'invoice': None,
            'po': None,
            'gr': None
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files)
                else:
                    response = requests.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if 'id' in response_data:
                        print(f"   Created ID: {response_data['id']}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        return self.run_test("Health Check", "GET", "api/health", 200)

    def test_create_invoice(self):
        """Create a test invoice"""
        invoice_data = {
            "invoice_number": "INV-001",
            "vendor_name": "ABC Corp",
            "invoice_date": "2024-01-15",
            "total_amount": 10000.0,
            "line_items": [
                {
                    "description": "Laptops",
                    "quantity": 10.0,
                    "unit_price": 1000.0,
                    "amount": 10000.0
                }
            ]
        }
        
        success, response = self.run_test(
            "Create Invoice",
            "POST",
            "api/invoices",
            200,
            data=invoice_data
        )
        
        if success and 'id' in response:
            self.created_ids['invoice'] = response['id']
        
        return success

    def test_create_purchase_order(self):
        """Create a test purchase order with slight price difference"""
        po_data = {
            "po_number": "PO-001",
            "vendor_name": "ABC Corp",
            "po_date": "2024-01-10",
            "total_amount": 10500.0,
            "line_items": [
                {
                    "description": "Laptops",
                    "quantity": 10.0,
                    "unit_price": 1050.0,  # Price variance
                    "amount": 10500.0
                }
            ]
        }
        
        success, response = self.run_test(
            "Create Purchase Order",
            "POST",
            "api/purchase-orders",
            200,
            data=po_data
        )
        
        if success and 'id' in response:
            self.created_ids['po'] = response['id']
        
        return success

    def test_create_goods_receipt(self):
        """Create a test goods receipt with quantity variance"""
        gr_data = {
            "gr_number": "GR-001",
            "po_number": "PO-001",
            "vendor_name": "ABC Corp",
            "receipt_date": "2024-01-20",
            "line_items": [
                {
                    "description": "Laptops",
                    "quantity": 9.0,  # Quantity variance - only 9 received
                    "unit_price": 1050.0,
                    "amount": 9450.0
                }
            ]
        }
        
        success, response = self.run_test(
            "Create Goods Receipt",
            "POST",
            "api/goods-receipts",
            200,
            data=gr_data
        )
        
        if success and 'id' in response:
            self.created_ids['gr'] = response['id']
        
        return success

    def test_get_invoices(self):
        """Test getting all invoices"""
        return self.run_test("Get Invoices", "GET", "api/invoices", 200)

    def test_get_purchase_orders(self):
        """Test getting all purchase orders"""
        return self.run_test("Get Purchase Orders", "GET", "api/purchase-orders", 200)

    def test_get_goods_receipts(self):
        """Test getting all goods receipts"""
        return self.run_test("Get Goods Receipts", "GET", "api/goods-receipts", 200)

    def test_three_way_verification(self):
        """Test 3-way matching verification"""
        if not all(self.created_ids.values()):
            print("❌ Cannot test verification - missing document IDs")
            return False
        
        verification_data = {
            "invoice_id": self.created_ids['invoice'],
            "po_id": self.created_ids['po'],
            "gr_id": self.created_ids['gr']
        }
        
        success, response = self.run_test(
            "3-Way Verification",
            "POST",
            "api/verify",
            200,
            data=verification_data
        )
        
        if success:
            print(f"   Overall Status: {response.get('overall_status', 'N/A')}")
            print(f"   Price Variance: {response.get('price_variance', 0) * 100:.2f}%")
            print(f"   Quantity Variance: {response.get('quantity_variance', 0) * 100:.2f}%")
            print(f"   Total Variance: ${response.get('total_variance', 0):.2f}")
        
        return success

    def test_get_verification_results(self):
        """Test getting verification results"""
        return self.run_test("Get Verification Results", "GET", "api/verification-results", 200)

def main():
    print("🚀 Starting Invoice Verification System API Tests")
    print("=" * 60)
    
    tester = InvoiceVerificationTester()
    
    # Test sequence
    tests = [
        ("Health Check", tester.test_health_check),
        ("Create Invoice", tester.test_create_invoice),
        ("Create Purchase Order", tester.test_create_purchase_order),
        ("Create Goods Receipt", tester.test_create_goods_receipt),
        ("Get Invoices", tester.test_get_invoices),
        ("Get Purchase Orders", tester.test_get_purchase_orders),
        ("Get Goods Receipts", tester.test_get_goods_receipts),
        ("3-Way Verification", tester.test_three_way_verification),
        ("Get Verification Results", tester.test_get_verification_results)
    ]
    
    # Run all tests
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
    
    # Print summary
    print("\n" + "=" * 60)
    print(f"📊 Test Summary:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%" if tester.tests_run > 0 else "0%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())