const express = require("express");
const moment = require("moment");
const Response = require("../lib/Response");
const AuditLogs = require("../db/models/AuditLogs");
const Categories = require("../db/models/Categories");
const Users = require("../db/models/Users");
const router = express.Router();
const auth = require("../lib/auth")();

router.all("*", auth.authenticate(), (req, res, next) => {
    next();
});

/*
1. Audit logs tablosunda işlem yapan kişilerin hangi tip işlemi kaç kez yaptığını veren bir sorgu.
2. Kategori tablosunda tekil veri sayısı.
3. Sistemde tanımlı kaç kullanıcı var?
*/
// /api/stats/auditlogs
router.post("/auditlogs", async (req, res) => {
    try {

        let body = req.body;
        let filter = {};

        if (typeof body.location === "string") filter.location = body.location;

        let result = await AuditLogs.aggregate([
            { $match: filter },
            { $group: { _id: { email: "$email", proc_type: "$proc_type" }, count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        res.json(Response.successResponse(result));


    } catch (err) {
        let errorResponse = Response.errorResponse(err, req.user?.language);
        res.status(errorResponse.code).json(errorResponse);
    }
});

// /api/stats/categories/unique
router.post("/categories/unique", async (req, res) => {
    try {

        let body = req.body;
        let filter = {};

        if (typeof body.is_active === "boolean") filter.is_active = body.is_active;

        let result = await Categories.distinct("name", filter);

        res.json(Response.successResponse({ result, count: result.length }));


    } catch (err) {
        let errorResponse = Response.errorResponse(err, req.user?.language);
        res.status(errorResponse.code).json(errorResponse);
    }
});

// /api/stats/users/count
router.post("/users/count", async (req, res) => {
    try {

        let body = req.body;
        let filter = {};

        if (typeof body.is_active === "boolean") filter.is_active = body.is_active;

        let result = await Users.countDocuments(filter);

        res.json(Response.successResponse(result));


    } catch (err) {
        let errorResponse = Response.errorResponse(err, req.user?.language);
        res.status(errorResponse.code).json(errorResponse);
    }
});

// /api/stats/users/monthly - Aylık kullanıcı kayıtları istatistiği
router.post("/users/monthly", async (req, res) => {
    try {
        let body = req.body;
        let matchQuery = {};
        
        // Tarih aralığı filtresi oluştur
        if (body.begin_date && body.end_date) {
            matchQuery.created_at = {
                $gte: new Date(body.begin_date),
                $lte: new Date(body.end_date)
            };
        } else {
            // Varsayılan olarak son 6 ay
            const endDate = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 5);
            
            matchQuery.created_at = {
                $gte: startDate,
                $lte: endDate
            };
        }

        // Aylık kayıt istatistiklerini çek
        const monthlyStats = await Users.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: {
                        year: { $year: "$created_at" },
                        month: { $month: "$created_at" }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    month: {
                        $dateFromParts: {
                            year: "$_id.year",
                            month: "$_id.month",
                            day: 1
                        }
                    },
                    count: 1
                }
            },
            { $sort: { month: 1 } }
        ]);

        res.json(Response.successResponse({ data: monthlyStats }));
    } catch (err) {
        let errorResponse = Response.errorResponse(err, req.user?.language);
        res.status(errorResponse.code).json(errorResponse);
    }
});

module.exports = router;