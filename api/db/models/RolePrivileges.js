const mongoose = require("mongoose")

const schema = mongoose.Schema({
    role_id: { tpye: mongoose.SchemaType.ObjectID, required: true },
    permission: { type: String, required: true },
    created_by: {
        type: mongoose.SchemaTypes.ObjectId,
        required: true
    }

},{
    versionKey: false,
    timestamps: {
        createdAt: "created_at",
        uptadetAt: "updated_at"
    }
})

class RolePrivileges extends mongoose.Model {

}

schema.loadClass(RolePrivileges);
module.exports = mongoose.model("role_privileges", schema)