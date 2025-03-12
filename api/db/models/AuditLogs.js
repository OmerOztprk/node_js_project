const mongoose = require("mongoose")

const schema = mongoose.Schema({
    level: String,
    email: String,
    password: String,
    location: String,
    proc_type: String,
    log: String

},{
    timestamps: {
        createdAt: "created_at",
        uptadetAt: "updated_at"
    }
})

class AuditLogs extends mongoose.Model {

}

schema.loadClass(AuditLogs);
module.exports = mongoose.model("audit_logs", schema)