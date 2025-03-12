const mongoose = require("mongoose")

const schema = mongoose.Schema({
    role_id: { type: mongoose.SchemaType.ObjectId, required: true},
    user_id: { type: mongoose.SchemaType.ObjectId, required: true},

},{
    timestamps: {
        createdAt: "created_at",
        uptadetAt: "updated_at"
    }
})

class UserRoles extends mongoose.Model {

}

schema.loadClass(UserRoles);
module.exports = mongoose.model("user_roles", schema)