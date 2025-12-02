const express = require('express');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const Payment = require('../models/Payment');
const Request = require('../models/Request');
const Mechanic = require('../models/Mechanic');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const send = (res, { success = true, status = 200, message = 'Data retrieved successfully', data = {} } = {}) => res.status(status).json({ success, message, data });

// Base ping and simple public test endpoint to verify wiring
router.get('/', (req, res) => {
  return res.json({ success: true, message: 'Payment API', endpoints: ['POST /','GET /:id','GET /:id/invoice','GET /user/history','GET /mechanic/history','GET /stats','POST /process','GET /verify/:transactionId','GET /test'] });
});

router.get('/test', (req, res) => {
  return res.json({ success: true, message: 'Payment test endpoint OK' });
});

// POST /api/payment
// Record a payment for a request
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { requestId, amount, method = 'cash', transactionId = '', commissionRate = 0.1 } = req.body;

    // Basic validations
    if (!requestId) {
      return res.status(400).json({ success: false, message: 'requestId is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ success: false, message: 'Invalid request ID format' });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be a positive number' });
    }

    const request = await Request.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    // Only requester or admin can create payment
    if (String(request.userId) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Prevent duplicate payments for already completed requests
    if (request.paymentStatus === 'payment_completed') {
      return res.status(409).json({ success: false, message: 'Payment already completed for this request' });
    }

    // Allow any positive amount - no limits for multiple services
    // Users can pay any amount they want for services
    // This supports multiple services and flexible pricing

    // If transactionId not provided, generate a sensible default
    const safeTransactionId = transactionId || `${String(method).toUpperCase()}-${Date.now()}`;

    const payment = new Payment({
      requestId: request._id,
      userId: request.userId,
      mechanicId: request.mechanicId || null,
      amount: numericAmount,
      method,
      transactionId: safeTransactionId,
      commissionRate,
      status: 'completed'
    });

    try {
      await payment.save();
    } catch (err) {
      // Surface duplicate/index errors gracefully
      if (err && err.code === 11000) {
        return res.status(409).json({ success: false, message: 'Duplicate payment detected', error: err.message });
      }
      throw err;
    }

    request.paymentStatus = 'payment_completed';
    request.actualCost = numericAmount;
    request.status = 'completed';
    request.payments = request.payments || [];
    request.payments.push(payment._id);
    await request.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`request_${request._id}`).emit('payment:completed', { requestId: request._id, amount: payment.amount, net: payment.netToMechanic });
      if (request.mechanicId) {
        const mech = await Mechanic.findById(request.mechanicId).populate('userId', 'name');
        if (mech?.userId?._id) {
          io.to(`user_${mech.userId._id}`).emit('payment:completed', { requestId: request._id, amount: payment.amount, net: payment.netToMechanic });
        }
      }
    }

    return send(res, { status: 201, message: 'Payment recorded successfully', data: { payment, request } });
  } catch (error) {
    console.error('Create payment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to record payment', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
});

// GET /api/payment/:id
// Get a single payment
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid payment ID' });
    const payment = await Payment.findById(id).populate(['requestId', 'userId', { path: 'mechanicId', populate: { path: 'userId', select: 'name phone' } }]);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    // Ownership or admin check
    if (String(payment.userId._id) !== String(req.user._id) && req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Access denied' });
    return send(res, { message: 'Payment retrieved successfully', data: { payment } });
  } catch (error) {
    console.error('Get payment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get payment', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
});

// GET /api/payment/:id/invoice
// Stream a PDF invoice for the payment
// Handle preflight explicitly for invoice route (download managers may trigger it)
router.options('/:id/invoice', (req, res) => {
  const origin = req.headers.origin || process.env.CLIENT_URL || 'http://localhost:3000';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  return res.sendStatus(204);
});

router.get('/:id/invoice', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid payment ID' });
    const payment = await Payment.findById(id)
      .populate([{ path: 'requestId', populate: [{ path: 'userId', select: 'name phone' }, { path: 'mechanicId', populate: { path: 'userId', select: 'name phone' } }] }, 'userId', { path: 'mechanicId', populate: { path: 'userId', select: 'name phone' } }]);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (String(payment.userId._id) !== String(req.user._id) && req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Access denied' });

    // Explicit CORS headers for streamed responses (some download managers intercept otherwise)
    const origin = req.headers.origin || process.env.CLIENT_URL || 'http://localhost:3000';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${payment._id}.pdf`);
    doc.pipe(res);

    // ========== Styles & Helpers ==========
    // Professional slate/blue palette
    const primary = '#1f2937'; // slate-800 (header bg)
    const accent = '#0ea5e9'; // sky-500
    const accentLight = '#bae6fd'; // sky-200
    const accentBg = '#e0f2fe'; // sky-100
    const gray = '#6b7280'; // gray-500
    const grayDark = '#374151'; // gray-700
    const light = '#e5e7eb'; // gray-200

    const currency = (n) => `BDT ${Number(n || 0).toFixed(2)}`;

    const hr = (y) => {
      doc.save().lineWidth(1).strokeColor(light).moveTo(50, y).lineTo(doc.page.width - 50, y).stroke().restore();
    };

    const labelValue = (x, y, label, value, opts = {}) => {
      const { w = 260 } = opts;
      doc.font('Helvetica-Bold').fillColor(gray).fontSize(9).text(label.toUpperCase(), x, y, { width: w });
      doc.font('Helvetica').fillColor('black').fontSize(11).text(value || '—', x, y + 12, { width: w });
      return y + 40; // increased spacing between label-value pairs
    };

    const sectionTitle = (title, y) => {
      // colored label chip with accent color
      doc.save().fillColor(accent).roundedRect(50, y, 180, 22, 6).fill().restore();
      doc.fillColor('white').font('Helvetica-Bold').fontSize(11).text(title.toUpperCase(), 60, y + 5);
      return y + 32;
    };

    const tableRow = (x, y, label, value, isBold = false) => {
      doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fillColor('black').fontSize(11);
      doc.text(label, x, y, { width: 280 });
      doc.text(value, x + 300, y, { width: 200, align: 'right' });
      return y + 24; // increased spacing between table rows
    };

    // ========== Header Bar ==========
    const headerHeight = 72;
    doc.save().rect(0, 0, doc.page.width, headerHeight).fill(primary).restore();

    // Simple wrench icon (vector) near title (no emoji font dependency)
    const drawWrench = (x, y, s = 1) => {
      doc.save().translate(x, y).scale(s).lineWidth(2).strokeColor('white').fillColor('white');
      // handle
      doc.moveTo(8, 24).lineTo(22, 10).stroke();
      // head (crescent)
      doc.circle(26, 8, 6).stroke();
      // cap circle to denote bolt
      doc.circle(26, 8, 2).fill();
      doc.restore();
    };

    drawWrench(50, 20, 1);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(18).text('RoadAssist BD', 78, 22);
    doc.fillColor(accentLight).font('Helvetica').fontSize(10).text('Invoice', 78, 44);

    // Invoice meta box (right)
    const metaX = doc.page.width - 260;
    const metaY = headerHeight + 20; // increased margin from header
    const metaW = 190;
    const metaH = 48;
    doc.save().roundedRect(metaX, metaY, metaW, metaH, 6).fill('white').restore();
    doc.fillColor(gray).font('Helvetica-Bold').fontSize(9).text('INVOICE ID', metaX + 12, metaY + 6);
    doc.fillColor('black').font('Helvetica').fontSize(11).text(String(payment._id), metaX + 12, metaY + 18, { width: metaW - 24, align: 'left' });

    doc.fillColor(gray).font('Helvetica-Bold').fontSize(9).text('DATE', metaX + 12, metaY + 32);
    doc.fillColor('black').font('Helvetica').fontSize(11).text(new Date(payment.createdAt).toLocaleString(), metaX + 12, metaY + 44, { width: metaW - 24, align: 'left' });

    // ========== Parties (two columns) ==========
    // Content starts below meta box with proper spacing
    let y = metaY + metaH + 30; // increased spacing after meta box
    y = sectionTitle('Billing Details', y);
    // card background with increased height for better spacing
    doc.save().roundedRect(50, y - 8, doc.page.width - 100, 130, 10).strokeColor(light).lineWidth(1).stroke().restore();
    const leftX = 60;
    const rightX = 340;
    let yLeft = y;
    let yRight = y;
    yLeft = labelValue(leftX, yLeft, 'Customer', `${payment.userId.name}\n${payment.userId.phone}`);
    yRight = labelValue(rightX, yRight, 'Mechanic', `${payment.mechanicId?.userId?.name || 'N/A'}\n${payment.mechanicId?.userId?.phone || 'N/A'}`);
    y = Math.max(yLeft, yRight) + 6;
    hr(y);
    y += 24; // increased spacing after billing details

    // ========== Service Details ==========
    const reqDoc = payment.requestId;
    y = sectionTitle('Service Details', y);
    // card background with increased height for better spacing
    doc.save().roundedRect(50, y - 8, doc.page.width - 100, 180, 10).strokeColor(light).lineWidth(1).stroke().restore();
    y = labelValue(60, y, 'Vehicle', reqDoc.vehicleType || 'N/A', { w: 240 });
    y = labelValue(60, y, 'Problem', reqDoc.problemType || 'N/A', { w: 240 });
    y = labelValue(60, y, 'Location', (reqDoc.pickupLocation?.address || 'N/A'), { w: 500 });
    y = labelValue(60, y, 'Status', reqDoc.status || 'N/A', { w: 240 });
    hr(y);
    y += 24; // increased spacing after service details

    // ========== Payment Summary (table) ==========
    y = sectionTitle('Payment Summary', y);
    // Highlighted colored box with increased height
    const boxHeight = 160;
    doc.save().roundedRect(50, y - 6, doc.page.width - 100, boxHeight, 10).fill(accentBg).restore();
    // inner border
    doc.save().roundedRect(50, y - 6, doc.page.width - 100, boxHeight, 10).lineWidth(1).strokeColor(accentLight).stroke().restore();
    y += 16; // increased padding inside payment summary box
    // Table header separators
    doc.save().moveTo(60, y - 4).lineTo(doc.page.width - 60, y - 4).strokeColor(accentLight).lineWidth(1).stroke().restore();
    y = tableRow(60, y, 'Amount', currency(payment.amount));
    doc.save().moveTo(60, y - 6).lineTo(doc.page.width - 60, y - 6).strokeColor(accentLight).lineWidth(0.8).stroke().restore();
    y = tableRow(60, y, `Commission (${Math.round(payment.commissionRate * 100)}%)`, currency(payment.commissionAmount));
    doc.save().moveTo(60, y - 6).lineTo(doc.page.width - 60, y - 6).strokeColor(accentLight).lineWidth(0.8).stroke().restore();
    y = tableRow(60, y, 'Net to Mechanic', currency(payment.netToMechanic), true);
    doc.save().moveTo(60, y - 6).lineTo(doc.page.width - 60, y - 6).strokeColor(accentLight).lineWidth(0.8).stroke().restore();
    y = tableRow(60, y, 'Method', String(payment.method || '').toUpperCase());
    doc.save().moveTo(60, y - 6).lineTo(doc.page.width - 60, y - 6).strokeColor(accentLight).lineWidth(0.8).stroke().restore();
    y = tableRow(60, y, 'Transaction ID', payment.transactionId || 'N/A');

    // Footer note with proper spacing and larger font
    y += 40; // increased spacing before footer
    doc.fillColor(grayDark).font('Helvetica-Bold').fontSize(12).text('Thank you for using RoadAssist BD', 50, y, { align: 'center', width: doc.page.width - 100 });
    // Add bottom margin
    y += 30;

    doc.end();
  } catch (error) {
    console.error('Invoice error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate invoice', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
});

// GET /api/payment/user/history
// Get user's payment history
router.get('/user/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, method, status, startDate, endDate } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = { userId: req.user._id };
    if (method) query.method = method;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const payments = await Payment.find(query)
      .populate([
        { path: 'requestId', select: 'vehicleType problemType pickupLocation status' },
        { path: 'mechanicId', populate: { path: 'userId', select: 'name phone' } }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Payment.countDocuments(query);

    return send(res, {
      message: 'Payment history retrieved successfully',
      data: {
        payments,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum
        }
      }
    });
  } catch (error) {
    console.error('Get user payment history error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get payment history',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/payment/mechanic/history
// Get mechanic's payment history
router.get('/mechanic/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, method, status, startDate, endDate } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Find mechanic by userId
    const mechanic = await Mechanic.findOne({ userId: req.user._id });
    if (!mechanic) {
      return res.status(404).json({
        success: false,
        message: 'Mechanic profile not found'
      });
    }

    // Build query
    const query = { mechanicId: mechanic._id };
    if (method) query.method = method;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const payments = await Payment.find(query)
      .populate([
        { path: 'requestId', select: 'vehicleType problemType pickupLocation status' },
        { path: 'userId', select: 'name phone' }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Payment.countDocuments(query);

    return send(res, {
      message: 'Payment history retrieved successfully',
      data: {
        payments,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum
        }
      }
    });
  } catch (error) {
    console.error('Get mechanic payment history error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get payment history',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/payment/stats
// Get payment statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchStage = {};

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    // Add user filter for non-admin users
    if (req.user.role !== 'admin') {
      matchStage.userId = req.user._id;
    }

    const stats = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalCommission: { $sum: '$commissionAmount' },
          avgAmount: { $avg: '$amount' },
          methodStats: {
            $push: {
              method: '$method',
              amount: '$amount'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalPayments: 1,
          totalAmount: 1,
          totalCommission: 1,
          avgAmount: 1,
          methodBreakdown: {
            $reduce: {
              input: '$methodStats',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $arrayToObject: [
                      [
                        {
                          k: '$$this.method',
                          v: {
                            $add: [
                              { $ifNull: [{ $getField: { field: '$$this.method', input: '$$value' } }, 0] },
                              '$$this.amount'
                            ]
                          }
                        }
                      ]
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    ]);

    return send(res, {
      message: 'Payment statistics retrieved successfully',
      data: {
        stats: stats[0] || {
          totalPayments: 0,
          totalAmount: 0,
          totalCommission: 0,
          avgAmount: 0,
          methodBreakdown: {}
        }
      }
    });
  } catch (error) {
    console.error('Get payment stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get payment statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /api/payment/process
// Process payment (for demo purposes)
router.post('/process', authenticateToken, async (req, res) => {
  try {
    const { requestId, amount, method, transactionId, commissionRate = 0.1 } = req.body;

    if (!requestId || !amount || !method) {
      return res.status(400).json({
        success: false,
        message: 'requestId, amount, and method are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request ID format'
      });
    }

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Only requester or admin can process payment
    if (String(request.userId) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Create payment record
    const payment = new Payment({
      requestId: request._id,
      userId: request.userId,
      mechanicId: request.mechanicId || null,
      amount,
      method,
      transactionId: transactionId || `${method.toUpperCase()}-${Date.now()}`,
      commissionRate,
      status: 'completed'
    });

    await payment.save();

    // Update request
    request.paymentStatus = 'payment_completed';
    request.actualCost = numericAmount;
    request.status = 'completed';
    request.payments = request.payments || [];
    request.payments.push(payment._id);
    await request.save();

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.to(`request_${request._id}`).emit('payment:completed', {
        requestId: request._id,
        amount: payment.amount,
        net: payment.netToMechanic
      });
      if (request.mechanicId) {
        const mech = await Mechanic.findById(request.mechanicId).populate('userId', 'name');
        io.to(`user_${mech.userId._id}`).emit('payment:completed', {
          requestId: request._id,
          amount: payment.amount,
          net: payment.netToMechanic
        });
      }
    }

    return send(res, {
      status: 201,
      message: 'Payment processed successfully',
      data: { payment, request }
    });
  } catch (error) {
    console.error('Process payment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process payment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/payment/verify/:transactionId
// Verify payment status
router.get('/verify/:transactionId', authenticateToken, async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    const payment = await Payment.findOne({ transactionId })
      .populate([
        { path: 'requestId', select: 'vehicleType problemType status' },
        { path: 'userId', select: 'name phone' },
        { path: 'mechanicId', populate: { path: 'userId', select: 'name phone' } }
      ]);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check access permissions
    if (String(payment.userId._id) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    return send(res, {
      message: 'Payment verification successful',
      data: { payment }
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;


