const express = require('express');
const mongoose = require('mongoose');
const Request = require('../models/Request');
const Mechanic = require('../models/Mechanic');
const Payment = require('../models/Payment');
const { authenticateToken, requireMechanic } = require('../middleware/auth');

const router = express.Router();

// Base ping to confirm wiring
router.get('/', (req, res) => {
  res.json({ success: true, message: 'History API', endpoints: ['GET /user','GET /mechanic'] });
});

// All routes require auth
router.use(authenticateToken);

// GET /api/history/user
// Fetch current user's requests with filters/pagination/sorting
router.get('/user', async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 10,
      status,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sort = '-createdAt',
      search,
      vehicleType,
      problemType
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = { userId };
    if (status) query.status = status;
    if (vehicleType) query.vehicleType = vehicleType;
    if (problemType) query.problemType = problemType;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (minAmount || maxAmount) {
      query.actualCost = {};
      if (minAmount) query.actualCost.$gte = Number(minAmount);
      if (maxAmount) query.actualCost.$lte = Number(maxAmount);
    }

    // Search functionality
    if (search) {
      query.$or = [
        { problemType: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'pickupLocation.address': { $regex: search, $options: 'i' } }
      ];
    }

    const requests = await Request.find(query)
      .populate([
        { path: 'userId', select: 'name phone profileImage' },
        { path: 'mechanicId', populate: { path: 'userId', select: 'name phone profileImage' } },
        { path: 'payments', select: 'amount method status paymentId createdAt' }
      ])
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Request.countDocuments(query);

    // Calculate statistics
    const stats = await Request.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalSpent: { $sum: '$actualCost' },
          avgRating: { $avg: '$rating.userRating' },
          completedRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          cancelledRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get status distribution
    const statusStats = await Request.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get monthly spending trend
    const monthlyTrend = await Request.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'completed' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalSpent: { $sum: '$actualCost' },
          requestCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);

    res.json({
      message: 'User history retrieved successfully',
      success: true,
      data: {
        requests,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum
        },
        statistics: {
          overview: stats[0] || {
            totalRequests: 0,
            totalSpent: 0,
            avgRating: 0,
            completedRequests: 0,
            cancelledRequests: 0
          },
          statusDistribution: statusStats,
          monthlyTrend
        }
      }
    });
  } catch (error) {
    console.error('History user error:', error);
    res.status(500).json({ message: 'Failed to fetch user history', success: false });
  }
});

// GET /api/history/user/export?format=csv
router.get('/user/export', async (req, res) => {
  try {
    const userId = req.user._id;
    const { format = 'csv' } = req.query;

    const items = await Request.find({ userId })
      .select('createdAt status vehicleType problemType actualCost paymentStatus')
      .sort({ createdAt: -1 });

    if (format === 'csv' || format === 'excel') {
      const header = 'Date,Status,Vehicle,Problem,Cost,Payment\n';
      const rows = items.map(i => [
        new Date(i.createdAt).toISOString(),
        i.status,
        i.vehicleType,
        i.problemType,
        i.actualCost || 0,
        i.paymentStatus || 'none'
      ].join(',')).join('\n');
      const csv = header + rows;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="user-history.csv"');
      return res.send(csv);
    }

    res.status(400).json({ message: 'Unsupported export format', success: false });
  } catch (error) {
    console.error('History user export error:', error);
    res.status(500).json({ message: 'Failed to export user history', success: false });
  }
});

// GET /api/history/user/ratings
router.get('/user/ratings', async (req, res) => {
  try {
    const userId = req.user._id;
    const ratings = await Request.find({ userId, 'rating.userRating': { $ne: null } })
      .select('rating createdAt mechanicId')
      .populate({ path: 'mechanicId', populate: { path: 'userId', select: 'name' } })
      .sort({ createdAt: -1 });
    res.json({ message: 'Ratings retrieved', success: true, data: { ratings } });
  } catch (error) {
    console.error('History user ratings error:', error);
    res.status(500).json({ message: 'Failed to fetch ratings', success: false });
  }
});

// GET /api/history/user/analytics
router.get('/user/analytics', async (req, res) => {
  try {
    const userId = req.user._id;
    const { period = '12months' } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate;
    switch (period) {
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3months':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '6months':
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '12months':
      default:
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
    }

    // Get comprehensive analytics
    const [
      overviewStats,
      statusDistribution,
      vehicleTypeStats,
      problemTypeStats,
      monthlyTrend,
      topMechanics,
      recentActivity
    ] = await Promise.all([
      // Overview statistics
      Request.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            totalSpent: { $sum: '$actualCost' },
            avgSpent: { $avg: '$actualCost' },
            completedRequests: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            cancelledRequests: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
            avgRating: { $avg: '$rating.userRating' }
          }
        }
      ]),

      // Status distribution
      Request.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: startDate } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Vehicle type statistics
      Request.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: startDate } } },
        { $group: { _id: '$vehicleType', count: { $sum: 1 }, totalSpent: { $sum: '$actualCost' } } },
        { $sort: { count: -1 } }
      ]),

      // Problem type statistics
      Request.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: startDate } } },
        { $group: { _id: '$problemType', count: { $sum: 1 }, totalSpent: { $sum: '$actualCost' } } },
        { $sort: { count: -1 } }
      ]),

      // Monthly trend
      Request.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            totalSpent: { $sum: '$actualCost' },
            requestCount: { $sum: 1 },
            completedCount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),

      // Top mechanics by rating
      Request.aggregate([
        { 
          $match: { 
            userId: new mongoose.Types.ObjectId(userId), 
            mechanicId: { $ne: null },
            'rating.userRating': { $ne: null },
            createdAt: { $gte: startDate }
          } 
        },
        {
          $group: {
            _id: '$mechanicId',
            avgRating: { $avg: '$rating.userRating' },
            requestCount: { $sum: 1 },
            totalSpent: { $sum: '$actualCost' }
          }
        },
        { $sort: { avgRating: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'mechanics',
            localField: '_id',
            foreignField: '_id',
            as: 'mechanic'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'mechanic.userId',
            foreignField: '_id',
            as: 'user'
          }
        }
      ]),

      // Recent activity
      Request.find({ userId, createdAt: { $gte: startDate } })
        .select('status createdAt problemType actualCost')
        .sort({ createdAt: -1 })
        .limit(10)
    ]);

    res.json({
      message: 'User analytics retrieved successfully',
      success: true,
      data: {
        period,
        overview: overviewStats[0] || {
          totalRequests: 0,
          totalSpent: 0,
          avgSpent: 0,
          completedRequests: 0,
          cancelledRequests: 0,
          avgRating: 0
        },
        statusDistribution,
        vehicleTypeStats,
        problemTypeStats,
        monthlyTrend,
        topMechanics,
        recentActivity
      }
    });
  } catch (error) {
    console.error('User analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch user analytics', success: false });
  }
});

// GET /api/history/mechanic
router.get('/mechanic', requireMechanic, async (req, res) => {
  try {
    const mechanic = await Mechanic.findOne({ userId: req.user._id });
    if (!mechanic) return res.json({ message: 'No mechanic profile', success: true, data: { requests: [], pagination: { current: 1, pages: 0, total: 0, limit: 10 } } });

    const {
      page = 1,
      limit = 10,
      status,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sort = '-createdAt'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = { mechanicId: mechanic._id };
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (minAmount || maxAmount) {
      query.actualCost = {};
      if (minAmount) query.actualCost.$gte = Number(minAmount);
      if (maxAmount) query.actualCost.$lte = Number(maxAmount);
    }

    const requests = await Request.find(query)
      .populate([
        { path: 'userId', select: 'name phone profileImage' },
        { path: 'mechanicId', populate: { path: 'userId', select: 'name phone profileImage' } }
      ])
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Request.countDocuments(query);

    res.json({
      message: 'Mechanic history retrieved successfully',
      success: true,
      data: {
        requests,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum
        }
      }
    });
  } catch (error) {
    console.error('History mechanic error:', error);
    res.status(500).json({ message: 'Failed to fetch mechanic history', success: false });
  }
});

// GET /api/history/mechanic/summary
router.get('/mechanic/summary', requireMechanic, async (req, res) => {
  try {
    const mechanic = await Mechanic.findOne({ userId: req.user._id });
    if (!mechanic) return res.json({ message: 'No mechanic profile', success: true, data: { totalJobs: 0, earnings: 0, avgRating: 0 } });

    const [jobsAgg, paymentsAgg] = await Promise.all([
      Request.aggregate([
        { $match: { mechanicId: new mongoose.Types.ObjectId(mechanic._id), status: 'completed' } },
        { $group: { _id: null, totalJobs: { $sum: 1 }, avgRating: { $avg: '$rating.userRating' } } }
      ]),
      Payment.aggregate([
        { $match: { mechanicId: new mongoose.Types.ObjectId(mechanic._id), status: 'completed' } },
        { $group: { _id: null, earnings: { $sum: '$netToMechanic' } } }
      ])
    ]);

    const totalJobs = jobsAgg[0]?.totalJobs || 0;
    const avgRating = jobsAgg[0]?.avgRating || 0;
    const earnings = paymentsAgg[0]?.earnings || 0;

    res.json({ message: 'Mechanic summary retrieved', success: true, data: { totalJobs, earnings, avgRating } });
  } catch (error) {
    console.error('Mechanic summary error:', error);
    res.status(500).json({ message: 'Failed to fetch mechanic summary', success: false });
  }
});

module.exports = router;


