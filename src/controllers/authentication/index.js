import { ValidationError } from "yup"
import { User } from "../../models/models.js"
import handlebars from "handlebars"
import fs from "fs"
import path from "path"
import cloudinary from "cloudinary"
import * as validation from "./validation.js"
import * as config from "../../config/index.js"
import transporter from "../../helpers/transporter.js"
import * as encryption from "../../helpers/encryption.js"
import * as tokenHelper from "../../helpers/token.js"
import * as errorMiddleware from "../../middlewares/error.handler.js"
import db from "../../models/index.js"
import { Op } from "sequelize";
import moment from "moment";

// import { ValidationError } from "yup"
// import * as config from "../../config/index.js"
// import * as helpers from "../../helpers/index.js"
// import * as error from "../../middlewares/error.handler.js"
// import { User, Profile } from "../../models/models.js"
// import db from "../../models/index.js"
// import * as validation from "./validation.js"

// // @register process
// export const register = async (req, res, next) => {
//     try {
//         // @create transaction
//         const transaction = await db.sequelize.transaction();
        
//         // @validation
//         const { username, password, email, phone } = req.body;
//         await validation.RegisterValidationSchema.validate(req.body);

//         // @check if user already exists
//         const userExists = await User?.findOne({ where: { username, email } });
//         if (userExists) throw ({ status : 400, message : error.USER_ALREADY_EXISTS });

//         // @create user -> encypt password
//         const hashedPassword = helpers.hashPassword(password);
//         const user = await User?.create({
//             username,
//             password : hashedPassword,
//             email,
//             phone
//         });

//         //@create profile 
//         await Profile?.create({ userId : user?.dataValues?.id });

//         // @delete password from response
//         delete user?.dataValues?.password;

//         // @generate access token
//         const accessToken = helpers.createToken({ id: user?.dataValues?.id, role : user?.dataValues?.role });

//         // @return response
//         res.header("Authorization", `Bearer ${accessToken}`)
//             .status(200)
//             .json({
//             message: "User created successfully",
//             user
//         });

        // //@send verification email
        // const mailOptions = {
        //     from: config.GMAIL,
        //     to: email,
        //     subject: "Verification",
        //     html: `<h1>Click <a href="http://localhost:5000/api/auth/verify/${accessToken}">here</a> to verify your account</h1>`
        // }
        // helpers.transporter.sendMail(mailOptions, (error, info) => {
        //     if (error) throw error;
        //     console.log("Email sent: " + info.response);
        // })

//         // @commit transaction
//         await transaction.commit();
//     } catch (error) {
//         // @rollback transaction
//         await transaction.rollback();

//         // @check if error from validation
//         if (error instanceof ValidationError) {
//             return next({ status : 400, message : error?.errors?.[0] })
//         }
//         next(error)
//     }
// }

// // @login process
// export const login = async (req, res, next) => {
//     try {
//         // @validation, we assume that username will hold either username or email
//         const { username, password } = req.body;
//         await validation.LoginValidationSchema.validate(req.body);

//         // @check if username is email
//         const isAnEmail = await validation.IsEmail(username);
//         const query = isAnEmail ? { email : username } : { username };

//         // @check if user exists include profile
//         const userExists = await User?.findOne({ where: query, include : Profile });
//         if (!userExists) throw ({ status : 400, message : error.USER_DOES_NOT_EXISTS })

//         // @check if user status is active (1), deleted (2), unverified (0)
//         if (userExists?.dataValues?.status === 2) throw ({ status : 400, message : error.USER_DOES_NOT_EXISTS });

//         // @check if password is correct
//         const isPasswordCorrect = helpers.comparePassword(password, userExists?.dataValues?.password);
//         if (!isPasswordCorrect) throw ({ status : 400, message : error.INVALID_CREDENTIALS });

//         // @generate access token
//         const accessToken = helpers.createToken({ id: userExists?.dataValues?.id, role : userExists?.dataValues?.role });

//         // @delete password from response
//         delete userExists?.dataValues?.password;

//         // @return response
//         res.header("Authorization", `Bearer ${accessToken}`)
//             .status(200)
//             .json({ user : userExists })
//     } catch (error) {
//         // @check if error from validation
//         if (error instanceof ValidationError) {
//             return next({ status : 400, message : error?.errors?.[0] })
//         }
//         next(error)
//     }
// }

// // @verify account
// export const verify = async (req, res, next) => {
//     try {
//         // @get token from params
//         const { token } = req.params;

//         // @verify token
//         const decodedToken = helpers.verifyToken(token);

//         // @update user status
//         await User?.update({ status : 1 }, { where : { id : decodedToken?.id } });

//         // @return response
//         res.status(200).json({ message : "Account verified successfully" })
//     } catch (error) {
//         next(error)
//     }
// }

// @delete account : soft delete
export const deleteAccount = async (req, res, next) => {
    try {
        // @get user id from token
        const { id } = req.user;

        // @delete user
        await User?.update({ status : 2 }, { where : { id } });

        // @return response
        res.status(200).json({ message : "Account deleted successfully" })
    } catch (error) {
        next(error)
    }
}

export const register = async (req, res, next) => {
    const transaction = await db.sequelize.transaction();
    try {
        const { username, password, email, phone } = req.body;

        await validation.RegisterValidationSchema.validate(req.body);

        const userExists = await User?.findOne({ 
            where: { 
                [Op.or]: [
                    { username },
                    { email }
                ]
            } 
        });

        if (userExists) throw ({ 
            status : errorMiddleware.BAD_REQUEST_STATUS, 
            message : errorMiddleware.USER_ALREADY_EXISTS 
        });

        const hashedPassword = encryption.hashPassword(password);

        const user = await User?.create({
            username,
            password : hashedPassword,
            email,
            phone
        });

        const accessToken = tokenHelper.createToken(
            { 
                id: user?.dataValues?.id, 
                username : user?.dataValues?.username 
            }
        );

        await User?.update(
            { 
                verify_token : accessToken,
                expired_token : moment().add(1, "days").format("YYYY-MM-DD HH:mm:ss")
            }, 
            { 
                where : { 
                    id : user?.dataValues?.id, 
                } 
            }
        )    

        delete user?.dataValues?.password;

        res.header("Authorization", `Bearer ${accessToken}`)
            .status(200)
            .json({
                message: "User created successfully",
                user
            });

        const template = fs.readFileSync(path.join(process.cwd(), "templates", "email.html"), "utf8");

        const message  = handlebars.compile(template)({ link : `http://localhost:3000/verification/${accessToken}` })

        const mailOptions = {
            from: config.GMAIL,
            to: email,
            subject: "Verification",
            html: message
        }

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) throw error;
            console.log("Email sent: " + info.response);
        })

        await transaction.commit();

    } catch (error) {
        await transaction.rollback();

        if (error instanceof ValidationError) {
            return next({
                status : errorMiddleware.BAD_REQUEST_STATUS, 
                message : error?.errors?.[0]
            })
        }

        next(error)
    }
}

export const login = async (req, res, next) => {
    try {
        const { username, password } = req.body;

        await validation.LoginValidationSchema.validate(req.body);

        const isAnEmail = await validation.IsEmail(username);

        const query = isAnEmail ? { email : username } : { username };

        const userExists = await User?.findOne(
            {
                where: query
            }
        );

        if (!userExists) throw ({ 
            status : errorMiddleware.BAD_REQUEST_STATUS, 
            message : errorMiddleware.USER_DOES_NOT_EXISTS 
        })
        
        const isPasswordCorrect = encryption.comparePassword(password, userExists?.dataValues?.password);

        if (!isPasswordCorrect) throw ({ 
            status : errorMiddleware.BAD_REQUEST_STATUS,
            message : errorMiddleware.INCORRECT_PASSWORD 
        });      

        if(!userExists.dataValues.user_status){
            const isTokenExpired = moment().isAfter(userExists?.dataValues?.expired_token);

            if(isTokenExpired){
                const accessToken = tokenHelper.createToken(
                    { 
                        id: userExists?.dataValues?.id, 
                        username : userExists?.dataValues?.username 
                    }
                );

                await User?.update(
                    { 
                        verify_token : accessToken,
                        expired_token : moment().add(1, "days").format("YYYY-MM-DD HH:mm:ss")
                    }, 
                    { 
                        where : { 
                            id : userExists.dataValues.id
                        } 
                    }
                )

                const template = fs.readFileSync(path.join(process.cwd(), "templates", "email.html"), "utf8");

                const message  = handlebars.compile(template)({ link : `http://localhost:3000/verification/${accessToken}` })

                const mailOptions = {
                    from: config.GMAIL,
                    to: userExists?.dataValues?.email,
                    subject: "Verification",
                    html: message
                }

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) throw error;
                    console.log("Email sent: " + info.response);
                })
            }

            return next({
                status : errorMiddleware.UNAUTHORIZED_STATUS, 
                message : errorMiddleware.UNVERIFIED
            })
        }
        
        const accessToken = tokenHelper.createTokenLogin({ 
            id: userExists?.dataValues?.id, 
            username : userExists?.dataValues?.username 
        });
        
        delete userExists?.dataValues?.password;

        res.header("Authorization", `Bearer ${accessToken}`)
            .status(200)
            .json({ 
                user : userExists 
            })

    } catch (error) {
        if (error instanceof ValidationError) {
            return next({ 
                status : errorMiddleware.BAD_REQUEST_STATUS, 
                message : error?.errors?.[0] 
            })
        }
        next(error)
    }
}

export const keepLogin = async (req, res, next) => {
    try {
        const users = await User?.findAll(
            { 
                where : {
                    id : req.user.id
                },
                attributes : {
                    exclude : ["password"]
                }
            }
        );

        if(!users[0].dataValues.user_status)throw ({ 
            status : errorMiddleware.UNAUTHORIZED_STATUS, 
            message : errorMiddleware.UNVERIFIED
        })

        res.status(200).json({ users })
    } catch (error) {
        next(error)
    }
}

export const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        
        await validation.EmailValidationSchema.validate(req.body);

        const isUserExist = await User?.findOne(
            { where : { email } }
        );

        if (!isUserExist) throw ({ 
            status : errorMiddleware.BAD_REQUEST_STATUS, 
            message : errorMiddleware.USER_DOES_NOT_EXISTS 
        })

        const accessToken = tokenHelper.createToken({ 
            id: isUserExist?.dataValues?.id, 
            username : isUserExist?.dataValues?.username 
        });

        await User?.update(
            { 
                verify_token : accessToken,
                expired_token : moment().add(1, "days").format("YYYY-MM-DD HH:mm:ss")
            }, 
            { 
                where : { 
                    id : isUserExist?.dataValues?.id
                } 
            }
        )

        const template = fs.readFileSync(path.join(process.cwd(), "templates", "email.html"), "utf8");

        const message  = handlebars.compile(template)({ link : `http://localhost:3000/reset_password/${accessToken}` })

        const mailOptions = {
            from: config.GMAIL,
            to: email,
            subject: "Reset Password",
            html: message
        }

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) throw error;
            console.log("Email sent: " + info.response);
        })

        res.status(200).json({ 
            message : "Check Your Email to Reset Your Password",
        })
    } catch (error) {
        if (error instanceof ValidationError) {
            return next({ 
                status : errorMiddleware.BAD_REQUEST_STATUS , 
                message : error?.errors?.[0] 
            })
        }
        next(error)
    }
}

export const resetPassword = async (req, res, next) => {
    const transaction = await db.sequelize.transaction();
    try {
        const { password } = req.body;

        await validation.resetPasswordSchema.validate(req.body);

        const userExists = await User?.findOne(
            {
                where: 
                {
                    id : req.user.id
                },
                attributes : {
                    exclude : ["verify_token","expired_token"]
                } 
            }
        );

        if (!userExists) throw ({ 
            status : errorMiddleware.BAD_REQUEST_STATUS, 
            message : errorMiddleware.USER_DOES_NOT_EXISTS 
        })

        const hashedPassword = encryption.hashPassword(password);

        await User?.update(
            { 
                password: hashedPassword,
                verify_token : null,
                expired_token : null 
            }, 
            { 
                where: {
                    id: req.user.id
                }
            }
        );

        const users = await User?.findAll(
            { 
                where : {
                    id : req.user.id
                },
                attributes : {
                    exclude : ["password"]
                }
            }
        );

        res.status(200).json({ 
            message : "Reset Password Success, Please Login Again",
            users
        })

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();

        if (error instanceof ValidationError) {
            return next({ 
                status : errorMiddleware.BAD_REQUEST_STATUS , 
                message : error?.errors?.[0] 
            })
        }

        next(error)
    }
}

export const verificationUser = async (req, res, next) => {
    const transaction = await db.sequelize.transaction();
    try {
        const { token } = req.body;

        const decodedToken = tokenHelper.verifyToken(token);

        const userExists = await User?.findOne({ 
            where : { 
                id : decodedToken.id 
            } 
        });

        if (!userExists) throw ({ 
            status : errorMiddleware.NOT_FOUND_STATUS, 
            message : errorMiddleware.USER_DOES_NOT_EXISTS 
        });

        await User?.update(
            { 
                user_status : 1,
                verify_token : null,
                expired_token : null 
            }, 
            { 
                where : { 
                    id : decodedToken.id 
                }
            }
        );

        res.status(200).json({ 
            message : "Verification Account Success" 
        })

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        next(error)
    }
}

export const changeUsername = async (req, res, next) => {
    const transaction = await db.sequelize.transaction();
    try {
        const { username } = req.body;

        await validation.changeUsernameSchema.validate(req.body);

        const usernameExists = await User?.findOne({ 
            where: { username }
        });

        if (usernameExists) throw ({ 
            status : errorMiddleware.BAD_REQUEST_STATUS, 
            message : errorMiddleware.USERNAME_ALREADY_EXISTS 
        });

        const user = await User?.findOne(
            { 
                where : {
                    id : req.user.id
                },
                attributes : {
                    exclude : ["password"]
                }
            }
        );

        const accessToken = tokenHelper.createToken({ 
            id: user?.dataValues?.id, 
            username : user?.dataValues?.username 
        });

        await User?.update(
            { 
                username,
                user_status : 0,
                verify_token : accessToken,
                expired_token : moment().add(1,"days").format("YYYY-MM-DD HH:mm:ss")
            }, 
            { 
                where: {
                    id: req.user.id
                }
            }
        );      
        
        const template = fs.readFileSync(path.join(process.cwd(), "templates", "email.html"), "utf8");

        const message  = handlebars.compile(template)({ link : `http://localhost:3000/verification/${accessToken}` })

        const mailOptions = {
            from: config.GMAIL,
            to: user?.dataValues?.email,
            subject: "Verification Change Username ",
            html: message
        }

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) throw error;
            console.log("Email sent: " + info.response);
        })

        res.status(200).json({ 
            message : "Change Username Success, Please Verify Again",
        })

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();

        if (error instanceof ValidationError) {
            return next({
                status : errorMiddleware.BAD_REQUEST_STATUS, 
                message : error?.errors?.[0]
            })
        }

        next(error)
    }
}

export const changePassword = async (req, res, next) => {
    const transaction = await db.sequelize.transaction();
    try {
        const { currentPassword, newPassword } = req.body;

        await validation.changePasswordSchema.validate(req.body);

        const user = await User?.findOne(
            {
                where: 
                {
                    id : req.user.id
                },
                attributes : {
                    exclude : ["verify_token","expired_token"]
                } 
            }
        );

        const isPasswordCorrect = encryption.comparePassword(currentPassword, user?.dataValues?.password);

        if (!isPasswordCorrect) throw ({ 
            status : errorMiddleware.BAD_REQUEST_STATUS,
            message : errorMiddleware.INCORRECT_PASSWORD 
        });  
        
        const hashedPassword = encryption.hashPassword(newPassword);

        await User?.update(
            { 
                password: hashedPassword 
            }, 
            { 
                where: {
                    id: req.user.id
                }
            }
        );

        const users = await User?.findAll(
            { 
                where : {
                    id : req.user.id
                },
                attributes : {
                    exclude : ["password"]
                }
            }
        );

        res.status(200).json({ 
            message : "Changed Password Success, Please Login Again",
            users
        })

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();

        if (error instanceof ValidationError) {
            return next({ 
                status : errorMiddleware.BAD_REQUEST_STATUS , 
                message : error?.errors?.[0] 
            })
        }

        next(error)
    }
}

export const changeEmail = async (req, res, next) => {
    const transaction = await db.sequelize.transaction();
    try {
        const { email } = req.body;

        await validation.EmailValidationSchema.validate(req.body);
        
        const emailExists = await User?.findOne({ 
            where: { email }
        });

        if (emailExists) throw ({ 
            status : errorMiddleware.BAD_REQUEST_STATUS, 
            message : errorMiddleware.EMAIL_ALREADY_EXISTS 
        });

        const user = await User?.findOne(
            { 
                where : {
                    id : req.user.id
                },
                attributes : {
                    exclude : ["password"]
                }
            }
        );

        const accessToken = tokenHelper.createToken({ 
            id: user?.dataValues?.id, 
            username : user?.dataValues?.username 
        });

        await User?.update(
            { 
                email,
                user_status : 0,
                verify_token : accessToken,
                expired_token : moment().add(1,"days").format("YYYY-MM-DD HH:mm:ss")
            }, 
            { 
                where: {
                    id : req.user.id
                }
            }
        );
        
        const template = fs.readFileSync(path.join(process.cwd(), "templates", "email.html"), "utf8");

        const message  = handlebars.compile(template)({ link : `http://localhost:3000/verification/${accessToken}` })

        const mailOptions = {
            from: config.GMAIL,
            to: email,
            subject: "Verification Change Email",
            html: message
        }

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) throw error;
            console.log("Email sent: " + info.response);
        })

        res.status(200).json({ 
            message : "Changed Email Success, Please Check Your Email to verify", 
        })

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();

        if (error instanceof ValidationError) {
            return next({
                status : errorMiddleware.BAD_REQUEST_STATUS, 
                message : error?.errors?.[0]
            })
        }
        next(error)
    }
}

export const changePhone = async (req, res, next) => {
    const transaction = await db.sequelize.transaction();
    try {
        const { phone } = req.body;
        
        await validation.changePhoneSchema.validate(req.body);

        const phoneExist = await User?.findOne(
            { where : { phone } }
        );

        if (phoneExist) throw ({ 
            status : errorMiddleware.BAD_REQUEST_STATUS, 
            message : errorMiddleware.PHONE_ALREADY_EXISTS 
        })

        const userExist = await User?.findOne(
            { 
                where : {
                    id : req.user.id
                },
                attributes : {
                    exclude : ["password"]
                }
            }
        );

        if (!userExist) throw ({
            status : errorMiddleware.NOT_FOUND_STATUS,
            message : errorMiddleware.USER_DOES_NOT_EXISTS
        })

        await User?.update(
            {
                phone
            },
            {
                where : 
                {
                    id : req.user.id
                }
            }
        )
        const user = await User?.findOne(
            { 
                where : 
                {
                    id : req.user.id
                },
                attributes : {
                    exclude : ['password']
                }
            }
        );

        res.status(200).json({ 
            message : "Changed Phone Number Success, Please Verify Again before Login",
            user
        })

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();

        if (error instanceof ValidationError) {
            return next({
                status : errorMiddleware.BAD_REQUEST_STATUS, 
                message : error?.errors?.[0]
            })
        }

        next(error)
    }
}

export const changeProfile = async (req, res, next) => {
    const transaction = await db.sequelize.transaction();
    try {
        if (!req.file) {
            return next ({ 
                status: errorMiddleware.BAD_REQUEST_STATUS,
                message: "Please upload an image." 
            })
        }

        const user = await User?.findOne(
            { 
                where : {
                    id : req.user.id
                },
                attributes : ['photo_profile']
            }
        );
        
        if(user?.dataValues?.photo_profile){
            cloudinary.v2.api
                .delete_resources([`${user?.dataValues?.photo_profile}`], 
                    { type: 'upload', resource_type: 'image' })
                .then(console.log);
        }

        await User?.update(
            { 
                photo_profile : req?.file?.filename 
            }, 
            { 
                where : { 
                    id : req.user.id 
                } 
            }
        )

        res.status(200).json(
            { 
                message : "Image uploaded successfully.", 
                imageUrl : req.file?.filename 
            }
        )

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        next(error)
    }
}

export const getProfilePicture = async (req, res, next) => {
    try {
        const user = await User?.findOne(
            { 
                where : 
                { 
                    id : req.user.id 
                } 
            }
        );

        if (!user) throw ({ 
            status : errorMiddleware.BAD_REQUEST_STATUS, 
            message : errorMiddleware.USER_DOES_NOT_EXISTS 
        })

        if (!user.photo_profile) throw ({ 
            status : errorMiddleware.NOT_FOUND_STATUS, 
            message : "Profile Picture is empty"
        })

        res.status(200).json(config.URL_PIC + user.photo_profile) 
    } catch (error) {
        next(error)
    }
}