import os
import uuid
import asyncio
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import pytesseract
from PIL import Image
import io
import fitz  # PyMuPDF for PDF processing
import re

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB setup
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(MONGO_URL)
db = client.invoice_verification

# Pydantic models
class LineItem(BaseModel):
    description: str
    quantity: float
    unit_price: float
    amount: float

class Invoice(BaseModel):
    id: Optional[str] = None
    invoice_number: str
    vendor_name: str
    invoice_date: str
    total_amount: float
    line_items: List[LineItem]
    status: Optional[str] = "pending"
    created_at: Optional[str] = None

class PurchaseOrder(BaseModel):
    id: Optional[str] = None
    po_number: str
    vendor_name: str
    po_date: str
    total_amount: float
    line_items: List[LineItem]
    status: Optional[str] = "open"
    created_at: Optional[str] = None

class GoodsReceipt(BaseModel):
    id: Optional[str] = None
    gr_number: str
    po_number: str
    vendor_name: str
    receipt_date: str
    line_items: List[LineItem]
    created_at: Optional[str] = None

class VerificationResult(BaseModel):
    id: Optional[str] = None
    invoice_id: str
    po_id: str
    gr_id: str
    verification_date: str
    overall_status: str  # "pass", "fail", "warning"
    line_item_matches: List[dict]
    total_variance: float
    price_variance: float
    quantity_variance: float
    created_at: Optional[str] = None

# OCR helper function
def extract_text_from_pdf(file_content: bytes) -> str:
    try:
        doc = fitz.open(stream=file_content, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing PDF: {str(e)}")

def parse_invoice_from_text(text: str) -> dict:
    """Basic invoice parsing from OCR text"""
    invoice_data = {
        "invoice_number": "",
        "vendor_name": "",
        "invoice_date": "",
        "total_amount": 0.0,
        "line_items": []
    }
    
    # Extract invoice number
    invoice_match = re.search(r'invoice\s*#?\s*:?\s*(\w+)', text, re.IGNORECASE)
    if invoice_match:
        invoice_data["invoice_number"] = invoice_match.group(1)
    
    # Extract total amount
    amount_match = re.search(r'total\s*:?\s*\$?(\d+\.?\d*)', text, re.IGNORECASE)
    if amount_match:
        invoice_data["total_amount"] = float(amount_match.group(1))
    
    # Extract date
    date_match = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', text)
    if date_match:
        invoice_data["invoice_date"] = date_match.group(1)
    
    return invoice_data

# 3-Way Matching Logic
def perform_three_way_match(invoice: Invoice, po: PurchaseOrder, gr: GoodsReceipt) -> VerificationResult:
    """Core 3-way matching algorithm"""
    
    verification_id = str(uuid.uuid4())
    line_matches = []
    total_variance = 0.0
    price_variance = 0.0
    quantity_variance = 0.0
    overall_status = "pass"
    
    tolerance = 0.05  # 5% tolerance for variances
    
    # Match line items
    for inv_item in invoice.line_items:
        # Find matching PO line item
        po_match = None
        gr_match = None
        
        for po_item in po.line_items:
            if po_item.description.lower() == inv_item.description.lower():
                po_match = po_item
                break
        
        for gr_item in gr.line_items:
            if gr_item.description.lower() == inv_item.description.lower():
                gr_match = gr_item
                break
        
        # Calculate variances
        price_diff = 0.0
        qty_diff = 0.0
        amount_diff = 0.0
        match_status = "pass"
        
        if po_match and gr_match:
            price_diff = abs(inv_item.unit_price - po_match.unit_price) / po_match.unit_price if po_match.unit_price > 0 else 0
            qty_diff = abs(inv_item.quantity - gr_match.quantity) / gr_match.quantity if gr_match.quantity > 0 else 0
            amount_diff = abs(inv_item.amount - (po_match.unit_price * gr_match.quantity))
            
            if price_diff > tolerance:
                match_status = "price_variance"
                overall_status = "warning" if overall_status == "pass" else "fail"
            
            if qty_diff > tolerance:
                match_status = "quantity_variance"
                overall_status = "warning" if overall_status == "pass" else "fail"
        
        else:
            match_status = "no_match"
            overall_status = "fail"
        
        line_matches.append({
            "description": inv_item.description,
            "invoice_qty": inv_item.quantity,
            "invoice_price": inv_item.unit_price,
            "invoice_amount": inv_item.amount,
            "po_qty": po_match.quantity if po_match else 0,
            "po_price": po_match.unit_price if po_match else 0,
            "gr_qty": gr_match.quantity if gr_match else 0,
            "price_variance_pct": price_diff * 100,
            "quantity_variance_pct": qty_diff * 100,
            "amount_variance": amount_diff,
            "status": match_status
        })
        
        total_variance += amount_diff
        price_variance += price_diff
        quantity_variance += qty_diff
    
    return VerificationResult(
        id=verification_id,
        invoice_id=invoice.id,
        po_id=po.id,
        gr_id=gr.id,
        verification_date=datetime.now().isoformat(),
        overall_status=overall_status,
        line_item_matches=line_matches,
        total_variance=total_variance,
        price_variance=price_variance,
        quantity_variance=quantity_variance,
        created_at=datetime.now().isoformat()
    )

# API Endpoints

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "invoice-verification"}

@app.post("/api/upload-invoice")
async def upload_invoice(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    file_content = await file.read()
    extracted_text = extract_text_from_pdf(file_content)
    parsed_data = parse_invoice_from_text(extracted_text)
    
    return {
        "filename": file.filename,
        "extracted_text": extracted_text,
        "parsed_data": parsed_data
    }

@app.post("/api/invoices")
async def create_invoice(invoice: Invoice):
    invoice.id = str(uuid.uuid4())
    invoice.created_at = datetime.now().isoformat()
    
    result = await db.invoices.insert_one(invoice.dict())
    return {"id": invoice.id, "message": "Invoice created successfully"}

@app.get("/api/invoices")
async def get_invoices():
    invoices = []
    cursor = db.invoices.find()
    async for doc in cursor:
        doc['_id'] = str(doc['_id'])
        invoices.append(doc)
    return invoices

@app.post("/api/purchase-orders")
async def create_purchase_order(po: PurchaseOrder):
    po.id = str(uuid.uuid4())
    po.created_at = datetime.now().isoformat()
    
    result = await db.purchase_orders.insert_one(po.dict())
    return {"id": po.id, "message": "Purchase order created successfully"}

@app.get("/api/purchase-orders")
async def get_purchase_orders():
    pos = []
    cursor = db.purchase_orders.find()
    async for doc in cursor:
        doc['_id'] = str(doc['_id'])
        pos.append(doc)
    return pos

@app.post("/api/goods-receipts")
async def create_goods_receipt(gr: GoodsReceipt):
    gr.id = str(uuid.uuid4())
    gr.created_at = datetime.now().isoformat()
    
    result = await db.goods_receipts.insert_one(gr.dict())
    return {"id": gr.id, "message": "Goods receipt created successfully"}

@app.get("/api/goods-receipts")
async def get_goods_receipts():
    grs = []
    cursor = db.goods_receipts.find()
    async for doc in cursor:
        doc['_id'] = str(doc['_id'])
        grs.append(doc)
    return grs

@app.post("/api/verify")
async def verify_three_way_match(verification_request: dict):
    invoice_id = verification_request.get("invoice_id")
    po_id = verification_request.get("po_id")
    gr_id = verification_request.get("gr_id")
    
    # Fetch documents
    invoice_doc = await db.invoices.find_one({"id": invoice_id})
    po_doc = await db.purchase_orders.find_one({"id": po_id})
    gr_doc = await db.goods_receipts.find_one({"id": gr_id})
    
    if not all([invoice_doc, po_doc, gr_doc]):
        raise HTTPException(status_code=404, detail="One or more documents not found")
    
    # Convert to Pydantic models
    invoice = Invoice(**invoice_doc)
    po = PurchaseOrder(**po_doc)
    gr = GoodsReceipt(**gr_doc)
    
    # Perform verification
    result = perform_three_way_match(invoice, po, gr)
    
    # Save verification result
    await db.verification_results.insert_one(result.dict())
    
    return result

@app.get("/api/verification-results")
async def get_verification_results():
    results = []
    cursor = db.verification_results.find()
    async for doc in cursor:
        doc['_id'] = str(doc['_id'])
        results.append(doc)
    return results

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)