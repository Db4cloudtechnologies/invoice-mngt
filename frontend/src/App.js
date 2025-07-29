import React, { useState, useEffect } from 'react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [invoices, setInvoices] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [goodsReceipts, setGoodsReceipts] = useState([]);
  const [verificationResults, setVerificationResults] = useState([]);
  
  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Form states
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_number: '',
    vendor_name: '',
    invoice_date: '',
    total_amount: '',
    line_items: [{ description: '', quantity: '', unit_price: '', amount: '' }]
  });
  
  const [poForm, setPoForm] = useState({
    po_number: '',
    vendor_name: '',
    po_date: '',
    total_amount: '',
    line_items: [{ description: '', quantity: '', unit_price: '', amount: '' }]
  });
  
  const [grForm, setGrForm] = useState({
    gr_number: '',
    po_number: '',
    vendor_name: '',
    receipt_date: '',
    line_items: [{ description: '', quantity: '', unit_price: '', amount: '' }]
  });

  // Verification state
  const [verificationForm, setVerificationForm] = useState({
    invoice_id: '',
    po_id: '',
    gr_id: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invoicesRes, posRes, grsRes, verificationRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/invoices`),
        fetch(`${BACKEND_URL}/api/purchase-orders`),
        fetch(`${BACKEND_URL}/api/goods-receipts`),
        fetch(`${BACKEND_URL}/api/verification-results`)
      ]);
      
      setInvoices(await invoicesRes.json());
      setPurchaseOrders(await posRes.json());
      setGoodsReceipts(await grsRes.json());
      setVerificationResults(await verificationRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/upload-invoice`, {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      setUploadResult(result);
      
      // Auto-fill invoice form with parsed data
      if (result.parsed_data) {
        setInvoiceForm(prev => ({
          ...prev,
          ...result.parsed_data
        }));
        setActiveTab('invoice-entry');
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const addLineItem = (formType) => {
    const newItem = { description: '', quantity: '', unit_price: '', amount: '' };
    if (formType === 'invoice') {
      setInvoiceForm(prev => ({
        ...prev,
        line_items: [...prev.line_items, newItem]
      }));
    } else if (formType === 'po') {
      setPoForm(prev => ({
        ...prev,
        line_items: [...prev.line_items, newItem]
      }));
    } else if (formType === 'gr') {
      setGrForm(prev => ({
        ...prev,
        line_items: [...prev.line_items, newItem]
      }));
    }
  };

  const updateLineItem = (formType, index, field, value) => {
    const numValue = ['quantity', 'unit_price', 'amount'].includes(field) ? parseFloat(value) || 0 : value;
    
    if (formType === 'invoice') {
      setInvoiceForm(prev => ({
        ...prev,
        line_items: prev.line_items.map((item, i) => 
          i === index ? { ...item, [field]: numValue } : item
        )
      }));
    } else if (formType === 'po') {
      setPoForm(prev => ({
        ...prev,
        line_items: prev.line_items.map((item, i) => 
          i === index ? { ...item, [field]: numValue } : item
        )
      }));
    } else if (formType === 'gr') {
      setGrForm(prev => ({
        ...prev,
        line_items: prev.line_items.map((item, i) => 
          i === index ? { ...item, [field]: numValue } : item
        )
      }));
    }
  };

  const submitForm = async (formType) => {
    let endpoint = '';
    let data = {};
    
    if (formType === 'invoice') {
      endpoint = '/api/invoices';
      data = {
        ...invoiceForm,
        total_amount: parseFloat(invoiceForm.total_amount) || 0,
        line_items: invoiceForm.line_items.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity) || 0,
          unit_price: parseFloat(item.unit_price) || 0,
          amount: parseFloat(item.amount) || 0
        }))
      };
    } else if (formType === 'po') {
      endpoint = '/api/purchase-orders';
      data = {
        ...poForm,
        total_amount: parseFloat(poForm.total_amount) || 0,
        line_items: poForm.line_items.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity) || 0,
          unit_price: parseFloat(item.unit_price) || 0,
          amount: parseFloat(item.amount) || 0
        }))
      };
    } else if (formType === 'gr') {
      endpoint = '/api/goods-receipts';
      data = {
        ...grForm,
        line_items: grForm.line_items.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity) || 0,
          unit_price: parseFloat(item.unit_price) || 0,
          amount: parseFloat(item.amount) || 0
        }))
      };
    }
    
    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        fetchData();
        // Reset form
        if (formType === 'invoice') {
          setInvoiceForm({
            invoice_number: '',
            vendor_name: '',
            invoice_date: '',
            total_amount: '',
            line_items: [{ description: '', quantity: '', unit_price: '', amount: '' }]
          });
        } else if (formType === 'po') {
          setPoForm({
            po_number: '',
            vendor_name: '',
            po_date: '',
            total_amount: '',
            line_items: [{ description: '', quantity: '', unit_price: '', amount: '' }]
          });
        } else if (formType === 'gr') {
          setGrForm({
            gr_number: '',
            po_number: '',
            vendor_name: '',
            receipt_date: '',
            line_items: [{ description: '', quantity: '', unit_price: '', amount: '' }]
          });
        }
      }
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  const performVerification = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verificationForm)
      });
      
      if (response.ok) {
        fetchData();
        setActiveTab('verification-results');
      }
    } catch (error) {
      console.error('Verification error:', error);
    }
  };

  const renderLineItemForm = (items, formType) => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-4 gap-4 p-4 border border-gray-200 rounded-lg">
          <input
            type="text"
            placeholder="Description"
            value={item.description}
            onChange={(e) => updateLineItem(formType, index, 'description', e.target.value)}
            className="form-input"
          />
          <input
            type="number"
            placeholder="Quantity"
            value={item.quantity}
            onChange={(e) => updateLineItem(formType, index, 'quantity', e.target.value)}
            className="form-input"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Unit Price"
            value={item.unit_price}
            onChange={(e) => updateLineItem(formType, index, 'unit_price', e.target.value)}
            className="form-input"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Amount"
            value={item.amount}
            onChange={(e) => updateLineItem(formType, index, 'amount', e.target.value)}
            className="form-input"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => addLineItem(formType)}
        className="btn-secondary"
      >
        Add Line Item
      </button>
    </div>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'pass': return 'text-green-600 bg-green-100';
      case 'fail': return 'text-red-600 bg-red-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-gray-900">Invoice Verification System</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                3-Way Matching • PDF Upload • Real-time Verification
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'upload', label: 'PDF Upload' },
              { id: 'invoice-entry', label: 'Invoice Entry' },
              { id: 'po-entry', label: 'Purchase Order' },
              { id: 'gr-entry', label: 'Goods Receipt' },
              { id: 'verification', label: 'Verification' },
              { id: 'verification-results', label: 'Results' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* PDF Upload Tab */}
          {activeTab === 'upload' && (
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Upload Invoice PDF
                </h3>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="text-gray-600">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="mt-2 text-sm">Click to upload PDF file</p>
                    </div>
                  </label>
                  {uploadFile && (
                    <p className="mt-2 text-sm text-gray-500">
                      Selected: {uploadFile.name}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleFileUpload}
                  disabled={!uploadFile || uploading}
                  className="mt-4 btn-primary"
                >
                  {uploading ? 'Processing...' : 'Upload & Extract'}
                </button>
                
                {uploadResult && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900">Extraction Result:</h4>
                    <pre className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">
                      {JSON.stringify(uploadResult.parsed_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Invoice Entry Tab */}
          {activeTab === 'invoice-entry' && (
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Create Invoice
                </h3>
                <form onSubmit={(e) => { e.preventDefault(); submitForm('invoice'); }}>
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <input
                      type="text"
                      placeholder="Invoice Number"
                      value={invoiceForm.invoice_number}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoice_number: e.target.value }))}
                      className="form-input"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Vendor Name"
                      value={invoiceForm.vendor_name}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, vendor_name: e.target.value }))}
                      className="form-input"
                      required
                    />
                    <input
                      type="date"
                      placeholder="Invoice Date"
                      value={invoiceForm.invoice_date}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoice_date: e.target.value }))}
                      className="form-input"
                      required
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Total Amount"
                      value={invoiceForm.total_amount}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, total_amount: e.target.value }))}
                      className="form-input"
                      required
                    />
                  </div>
                  
                  {renderLineItemForm(invoiceForm.line_items, 'invoice')}
                  
                  <button type="submit" className="mt-6 btn-primary">
                    Create Invoice
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Purchase Order Entry Tab */}
          {activeTab === 'po-entry' && (
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Create Purchase Order
                </h3>
                <form onSubmit={(e) => { e.preventDefault(); submitForm('po'); }}>
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <input
                      type="text"
                      placeholder="PO Number"
                      value={poForm.po_number}
                      onChange={(e) => setPoForm(prev => ({ ...prev, po_number: e.target.value }))}
                      className="form-input"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Vendor Name"
                      value={poForm.vendor_name}
                      onChange={(e) => setPoForm(prev => ({ ...prev, vendor_name: e.target.value }))}
                      className="form-input"
                      required
                    />
                    <input
                      type="date"
                      placeholder="PO Date"
                      value={poForm.po_date}
                      onChange={(e) => setPoForm(prev => ({ ...prev, po_date: e.target.value }))}
                      className="form-input"
                      required
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Total Amount"
                      value={poForm.total_amount}
                      onChange={(e) => setPoForm(prev => ({ ...prev, total_amount: e.target.value }))}
                      className="form-input"
                      required
                    />
                  </div>
                  
                  {renderLineItemForm(poForm.line_items, 'po')}
                  
                  <button type="submit" className="mt-6 btn-primary">
                    Create Purchase Order
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Goods Receipt Entry Tab */}
          {activeTab === 'gr-entry' && (
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Create Goods Receipt
                </h3>
                <form onSubmit={(e) => { e.preventDefault(); submitForm('gr'); }}>
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <input
                      type="text"
                      placeholder="GR Number"
                      value={grForm.gr_number}
                      onChange={(e) => setGrForm(prev => ({ ...prev, gr_number: e.target.value }))}
                      className="form-input"
                      required
                    />
                    <input
                      type="text"
                      placeholder="PO Number"
                      value={grForm.po_number}
                      onChange={(e) => setGrForm(prev => ({ ...prev, po_number: e.target.value }))}
                      className="form-input"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Vendor Name"
                      value={grForm.vendor_name}
                      onChange={(e) => setGrForm(prev => ({ ...prev, vendor_name: e.target.value }))}
                      className="form-input"
                      required
                    />
                    <input
                      type="date"
                      placeholder="Receipt Date"
                      value={grForm.receipt_date}
                      onChange={(e) => setGrForm(prev => ({ ...prev, receipt_date: e.target.value }))}
                      className="form-input"
                      required
                    />
                  </div>
                  
                  {renderLineItemForm(grForm.line_items, 'gr')}
                  
                  <button type="submit" className="mt-6 btn-primary">
                    Create Goods Receipt
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Verification Tab */}
          {activeTab === 'verification' && (
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  3-Way Matching Verification
                </h3>
                <div className="grid grid-cols-3 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Invoice
                    </label>
                    <select
                      value={verificationForm.invoice_id}
                      onChange={(e) => setVerificationForm(prev => ({ ...prev, invoice_id: e.target.value }))}
                      className="form-input"
                      required
                    >
                      <option value="">Choose Invoice</option>
                      {invoices.map(invoice => (
                        <option key={invoice.id} value={invoice.id}>
                          {invoice.invoice_number} - {invoice.vendor_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Purchase Order
                    </label>
                    <select
                      value={verificationForm.po_id}
                      onChange={(e) => setVerificationForm(prev => ({ ...prev, po_id: e.target.value }))}
                      className="form-input"
                      required
                    >
                      <option value="">Choose PO</option>
                      {purchaseOrders.map(po => (
                        <option key={po.id} value={po.id}>
                          {po.po_number} - {po.vendor_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Goods Receipt
                    </label>
                    <select
                      value={verificationForm.gr_id}
                      onChange={(e) => setVerificationForm(prev => ({ ...prev, gr_id: e.target.value }))}
                      className="form-input"
                      required
                    >
                      <option value="">Choose GR</option>
                      {goodsReceipts.map(gr => (
                        <option key={gr.id} value={gr.id}>
                          {gr.gr_number} - {gr.vendor_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <button
                  onClick={performVerification}
                  disabled={!verificationForm.invoice_id || !verificationForm.po_id || !verificationForm.gr_id}
                  className="btn-primary"
                >
                  Perform 3-Way Match
                </button>
              </div>
            </div>
          )}

          {/* Verification Results Tab */}
          {activeTab === 'verification-results' && (
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Verification Results
                </h3>
                <div className="space-y-6">
                  {verificationResults.map((result, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-medium text-gray-900">
                          Verification {index + 1}
                        </h4>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(result.overall_status)}`}>
                          {result.overall_status.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                        <div>
                          <span className="font-medium">Total Variance:</span> ${result.total_variance.toFixed(2)}
                        </div>
                        <div>
                          <span className="font-medium">Price Variance:</span> {(result.price_variance * 100).toFixed(2)}%
                        </div>
                        <div>
                          <span className="font-medium">Quantity Variance:</span> {(result.quantity_variance * 100).toFixed(2)}%
                        </div>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">GR</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {result.line_item_matches.map((match, i) => (
                              <tr key={i}>
                                <td className="px-6 py-4 text-sm text-gray-900">{match.description}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                  {match.invoice_qty} × ${match.invoice_price} = ${match.invoice_amount}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                  {match.po_qty} × ${match.po_price}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                  {match.gr_qty}
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(match.status)}`}>
                                    {match.status.replace('_', ' ').toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
        </div>
      </main>
    </div>
  );
}

export default App;