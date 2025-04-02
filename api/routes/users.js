var express = require('express');
const bcrypt = require("bcrypt-nodejs");
const is = require("is_js");
const jwt = require("jwt-simple");

const Users = require('../db/models/Users');
const Response = require("../lib/Response");
const CustomError = require('../lib/Error');
const Enum = require('../config/Enum');
const UserRoles = require('../db/models/UserRoles');
const Roles = require('../db/models/Roles');
const config = require('../config');
var router = express.Router();
const auth = require("../lib/auth")();
const i18n = new (require("../lib/i18n"))(config.DEFAULT_LANG);
const { rateLimit } = require("express-rate-limit");
const RateLimitMongo = require("rate-limit-mongo");
const AuditLogs = require("../lib/AuditLogs");

/*const limiter = rateLimit({
  store: new RateLimitMongo({
    uri: config.CONNECTION_STRING,
    collectionName: "rateLimits",
    expireTimeMs: 15 * 60 * 1000 // 15 minutes
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
  // standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
});*/

// Kimlik doğrulama gerektirmeyen rotalar
router.post("/register", async (req, res) => {
  let body = req.body;
  try {
    if (!body.email) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", "email field must be filled");
    if (is.not.email(body.email)) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", "email field must be an email format");
    if (!body.password) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", "password field must be filled");
    if (body.password.length < Enum.PASS_LENGTH) {
      throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Validation Error!", "password length must be greater than " + Enum.PASS_LENGTH);
    }

    let existingUser = await Users.findOne({ email: body.email });
    if (existingUser) {
      throw new CustomError(Enum.HTTP_CODES.CONFLICT, "Already Exists!", "User already exists");
    }

    let password = bcrypt.hashSync(body.password, bcrypt.genSaltSync(8), null);
    let createdUser = await Users.create({
      email: body.email,
      password,
      is_active: true,
      first_name: body.first_name,
      last_name: body.last_name,
      phone_number: body.phone_number
    });

    // SUPER_ADMIN rolü olup olmadığını kontrol et, yoksa ekle
    let role = await Roles.findOne({ role_name: Enum.SUPER_ADMIN });
    if (!role) {
      role = await Roles.create({
        role_name: Enum.SUPER_ADMIN,
        is_active: true,
        created_by: createdUser._id
      });
    }

    await UserRoles.create({
      role_id: role._id,
      user_id: createdUser._id
    });

    res.status(Enum.HTTP_CODES.CREATED).json(Response.successResponse({ success: true }, Enum.HTTP_CODES.CREATED));
  } catch (err) {
    let errorResponse = Response.errorResponse(err);
    res.status(errorResponse.code).json(errorResponse);
  }
});

router.post("/auth", async (req, res) => {
  try {
    let { email, password } = req.body;

    Users.validateFieldsBeforeAuth(email, password);

    let user = await Users.findOne({ email });

    if (!user) throw new CustomError(Enum.HTTP_CODES.UNAUTHORIZED, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", config.DEFAULT_LANG,), i18n.translate("USERS.AUTH_ERROR", config.DEFAULT_LANG,));

    if (!user.validPassword(password)) throw new CustomError(Enum.HTTP_CODES.UNAUTHORIZED, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", config.DEFAULT_LANG), i18n.translate("USERS.AUTH_ERROR", config.DEFAULT_LANG));

    let payload = {
      id: user._id,
      exp: parseInt(Date.now() / 1000) + config.JWT.EXPIRE_TIME
    }

    let token = jwt.encode(payload, config.JWT.SECRET);

    let userData = {
      _id: user._id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name
    }

    res.json(Response.successResponse({ token, user: userData }));
  } catch (err) {
    let errorResponse = Response.errorResponse(err);
    res.status(errorResponse.code).json(errorResponse);
  }
});

// Önce kimlik doğrulama middleware'i çalıştır
router.all('*', auth.authenticate(), (req, res, next) => {
  next();
});

// Kullanıcı ekleme - artık auth.authenticate() middleware'inden sonra tanımlanıyor
router.post("/add", auth.checkRoles("user_add"), async (req, res) => {
  try {
    let body = req.body;
    console.log("Kullanıcı ekleme isteği alındı:", body);

    // 1. Email validasyonu
    if (!body.email) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("COMMON.FIELD_MUST_BE_FILLED", req.user.language, ["email"]));

    if (is.not.email(body.email)) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("USERS.EMAIL_FORMAT_ERROR", req.user.language));

    // 2. Şifre validasyonu
    if (!body.password) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("COMMON.FIELD_MUST_BE_FILLED", req.user.language, ["password"]));

    if (body.password.length < Enum.PASS_LENGTH) {
      throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("USERS.PASSWORD_LENGTH_ERROR", req.user.language, [Enum.PASS_LENGTH]));
    }
    
    // 3. E-posta kontrolü
    let existingUser = await Users.findOne({ email: body.email });
    if (existingUser) {
      throw new CustomError(Enum.HTTP_CODES.CONFLICT, i18n.translate("COMMON.ALREADY_EXIST", req.user.language), "Email " + i18n.translate("COMMON.ALREADY_EXIST", req.user.language));
    }
    
    // 4. Rol validasyonu
    if (!body.roles) {
      throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("COMMON.FIELD_MUST_BE_FILLED", req.user.language, ["roles"]));
    }
    
    if (!Array.isArray(body.roles)) {
      throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("COMMON.FIELD_MUST_BE_TYPE", req.user.language, ["roles", "Array"]));
    }
    
    if (body.roles.length === 0) {
      throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), "En az bir rol seçilmelidir");
    }
    
    // 5. Rol kontrolü
    let roles = await Roles.find({ _id: { $in: body.roles } });
    if (!roles || roles.length === 0) {
      throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), "Seçilen roller bulunamadı");
    }
    
    // 6. Kullanıcı oluşturma
    let password = bcrypt.hashSync(body.password, bcrypt.genSaltSync(8), null);

    let user = await Users.create({
      email: body.email,
      password,
      is_active: body.is_active !== undefined ? body.is_active : true,
      first_name: body.first_name || "",
      last_name: body.last_name || "",
      phone_number: body.phone_number || ""
    });
    
    // 7. Kullanıcı rollerini ekle
    for (let role of roles) {
      await UserRoles.create({
        role_id: role._id,
        user_id: user._id
      });
    }
    
    // Kullanıcı ekleme işlemini loglama
    if (typeof AuditLogs !== 'undefined') {
      AuditLogs.info(req.user?.email, "Users", "Add", { 
        user_id: user._id, 
        email: user.email, 
        roles: roles.map(r => r.role_name)
      });
    }
    
    res.status(Enum.HTTP_CODES.CREATED).json(Response.successResponse({ success: true }, Enum.HTTP_CODES.CREATED));
  } catch (err) {
    console.error("Kullanıcı ekleme hatası:", err);
    let errorResponse = Response.errorResponse(err);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/* GET users listing. */
router.get('/', auth.checkRoles("user_view"), async (req, res) => {
  try {
    let users = await Users.find({}, { password: 0 }).lean();

    for (let i = 0; i < users.length; i++) {
      let roles = await UserRoles.find({ user_id: users[i]._id }).populate("role_id");
      users[i].roles = roles;
    }

    res.json(Response.successResponse(users));
  } catch (err) {
    let errorResponse = Response.errorResponse(err);
    res.status(errorResponse.code).json(errorResponse);
  }
});

router.post("/update", auth.checkRoles("user_update"), async (req, res) => {
  try {
    let body = req.body;
    let updates = {};
    
    console.log("Kullanıcı güncelleme isteği alındı:", body);

    if (!body._id) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("COMMON.FIELD_MUST_BE_FILLED", req.user.language, ["_id"]));

    // Email kontrolü
    if (body.email) {
      if (is.not.email(body.email)) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("USERS.EMAIL_FORMAT_ERROR", req.user.language));
      
      // Email değişmiş mi kontrol et
      const existingUserWithEmail = await Users.findOne({ email: body.email, _id: { $ne: body._id } });
      if (existingUserWithEmail) {
        throw new CustomError(Enum.HTTP_CODES.CONFLICT, i18n.translate("COMMON.ALREADY_EXIST", req.user.language), "Email " + i18n.translate("COMMON.ALREADY_EXIST", req.user.language));
      }
      
      updates.email = body.email;
    }

    // Şifre kontrolü - eğer şifre geldiyse ve yeterince uzunsa güncelle
    if (body.password) {
      if (body.password.length < Enum.PASS_LENGTH) {
        throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("USERS.PASSWORD_LENGTH_ERROR", req.user.language, [Enum.PASS_LENGTH]));
      }
      updates.password = bcrypt.hashSync(body.password, bcrypt.genSaltSync(8), null);
    }

    // Diğer alanları güncelle
    if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
    if (body.first_name !== undefined) updates.first_name = body.first_name;
    if (body.last_name !== undefined) updates.last_name = body.last_name;
    if (body.phone_number !== undefined) updates.phone_number = body.phone_number;

    // Kullanıcı kendisinin rollerini değiştiremez kontrolü
    if (body._id.toString() === req.user.id.toString()) {
      console.log("Kullanıcı kendi rollerini değiştirmeye çalışıyor - engellendi");
      body.roles = null;
    }

    // Rol işlemleri
    if (Array.isArray(body.roles) && body.roles.length > 0) {
      console.log("Rolleri güncelleme işlemi başlatılıyor");
      
      // Mevcut rolleri getir
      let userRoles = await UserRoles.find({ user_id: body._id });
      console.log("Mevcut roller:", userRoles);
      
      // Kaldırılacak rolleri belirle
      let roleIdsToRemove = [];
      for (const userRole of userRoles) {
        const roleIdStr = userRole.role_id.toString();
        if (!body.roles.includes(roleIdStr)) {
          roleIdsToRemove.push(userRole._id);
        }
      }
      
      console.log("Kaldırılacak rol IDs:", roleIdsToRemove);
      
      // Eklenecek rolleri belirle
      let existingRoleIds = userRoles.map(ur => ur.role_id.toString());
      let newRoleIds = body.roles.filter(r => !existingRoleIds.includes(r));
      
      console.log("Eklenecek rol IDs:", newRoleIds);

      // Rolleri kaldır
      if (roleIdsToRemove.length > 0) {
        await UserRoles.deleteMany({ _id: { $in: roleIdsToRemove } });
        console.log("Roller başarıyla kaldırıldı");
      }

      // Yeni rolleri ekle
      for (let roleId of newRoleIds) {
        await UserRoles.create({
          role_id: roleId,
          user_id: body._id
        });
        console.log("Yeni rol eklendi:", roleId);
      }
    }

    // Kullanıcıyı güncelle - eğer güncellenecek alan varsa
    if (Object.keys(updates).length > 0) {
      await Users.updateOne({ _id: body._id }, updates);
      console.log("Kullanıcı başarıyla güncellendi", updates);
    } else {
      console.log("Güncellenecek kullanıcı alanı bulunamadı");
    }
    
    // Güncelleme işlemini loglama
    if (typeof AuditLogs !== 'undefined') {
      AuditLogs.info(req.user?.email, "Users", "Update", { 
        user_id: body._id, 
        updates: { ...updates, roles: body.roles }
      });
    }
    
    res.json(Response.successResponse({ success: true }));
  } catch (err) {
    console.error("Kullanıcı güncelleme hatası:", err);
    let errorResponse = Response.errorResponse(err);
    res.status(errorResponse.code).json(errorResponse);
  }
});

router.post("/delete", auth.checkRoles("user_delete"), async (req, res) => {
  try {
    let body = req.body;

    if (!body._id) throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), i18n.translate("COMMON.FIELD_MUST_BE_FILLED", req.user.language, ["_id"]));

    // Kullanıcının kendisini silmesini engelle
    if (body._id.toString() === req.user.id.toString()) {
      throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, i18n.translate("COMMON.VALIDATION_ERROR_TITLE", req.user.language), "Kendinizi silemezsiniz");
    }

    // Kullanıcıyı sil
    await Users.deleteOne({ _id: body._id });
    await UserRoles.deleteMany({ user_id: body._id });

    // Log kaydı oluştur
    if (typeof AuditLogs !== 'undefined') {
      AuditLogs.info(req.user?.email, "Users", "Delete", { _id: body._id });
    }

    res.json(Response.successResponse({ success: true }));
  } catch (err) {
    console.error("Kullanıcı silme hatası:", err);
    let errorResponse = Response.errorResponse(err);
    res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;