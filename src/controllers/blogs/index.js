import sequelize from "sequelize";
import { ValidationError } from "yup"
import * as errorMiddleware from "../../middlewares/error.handler.js"
import { Blog, Category, Like, User} from "../../models/models.js"
import * as config from "../../config/index.js"
import { PublishBlogSchema } from "./validation.js";
import moment from "moment";
import db from "../../models/index.js"
import cloudinary from "cloudinary"

export const getBlogs = async (req, res, next) => {
    try {
        const { page, id_cat, sort } = req.query;

        const options = {
            offset: page > 1 ? parseInt(page - 1) * 5 : 0,
            limit: page ? 5 : undefined,
        }

        if( sort !== undefined && sort !== "DESC" && sort !== "ASC" )throw ({ 
            status : errorMiddleware.BAD_REQUEST_STATUS, 
            message : errorMiddleware.BAD_REQUEST 
        });

        const blogs = await Blog?.findAll(
            { 
                ...options,
                where : id_cat ? {categoryId : id_cat} : {},
                order : [
                    sort ? ['createdAt', sort] : ['id', 'ASC']
                ],
                include : [
                    {
                        model: User,
                        attributes: ['username','photo_profile']
                    },
                    {
                        model: Category,
                        attributes: ['name']
                    }, 
                    {
                        model: Like,
                        attributes: ['userId']
                    }
                ]
            }
        );

        const total = id_cat || id_cat && page ? await Blog?.count({where: {categoryId : id_cat}}) : await Blog?.count();

        const pages = page ? Math.ceil(total / options.limit) : undefined;
        
        if(!blogs.length ) throw ({ 
            status : errorMiddleware.NOT_FOUND_STATUS, 
            message : errorMiddleware.DATA_NOT_FOUND 
        });
        
        res.status(200).json({ 
            message: "success", 
            data: {
                current_page: page,
                total_pages : pages,
                total_blog : total,
                blog_limit : options.limit,
                blogs,
            } 
        });

    } catch (error) {
        next(error)
    }
}

export const publishBlog = async (req, res, next) => {
    const transaction = await db.sequelize.transaction();
    try {
        const { data } = req.body;    

        if (!req.file) {
            return next ({ 
                status: errorMiddleware.BAD_REQUEST_STATUS,
                message: "Please upload an image." 
            })
        }

        const body = JSON.parse(data);

        const { 
            title, 
            content, 
            country, 
            category, 
            url, 
            keywords 
        } = body
        
        await PublishBlogSchema.validate(body);
        
        const blogIsExists = await Blog?.findOne({ where : { title } });

        if (blogIsExists) throw (
            { 
                status : errorMiddleware.BAD_REQUEST_STATUS, 
                message : errorMiddleware.BLOG_ALREADY_EXISTS
            }
        );

        const blog = await Blog?.create({ 
            userId : req.user.id,
            createdAt: moment().format("YYYY-MM-DD HH:mm:ss"),
            title,
            content,
            country,
            categoryId : category,
            url,
            keywords, 
            blog_pic : req?.file?.filename 
        });

        res.status(200).json(
            { 
                type: "success", 
                message: "Blog published", 
                data: blog 
            }
        );

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();

        cloudinary.v2.api
            .delete_resources([`${req?.file?.filename}`],
                { type: 'upload', resource_type: 'image' })

        if (error instanceof ValidationError) {
            return next({
                status : errorMiddleware.BAD_REQUEST_STATUS, 
                message : error?.errors?.[0]
            })
        }

        next(error)
    }
}

export const deleteBlogs = async (req, res, next) => {
    try {
        const { id_blog } = req.params;

        const blogIsExists = await Blog?.findOne({ 
            where : { 
                id : id_blog
            } 
        });

        if (!blogIsExists) throw (
            { 
                status : errorMiddleware.NOT_FOUND_STATUS, 
                message : errorMiddleware.DATA_NOT_FOUND
            }
        );
        
        await Blog?.destroy({
            where : {
                id : id_blog
            }
        });

        await cloudinary.v2.api
            .delete_resources([`${blogIsExists.dataValues.blog_pic}`],
                { type: 'upload', resource_type: 'image' })

        res.status(200).json({ 
            type : 'success',
            message : "Delete success"
        })
    } catch (error) {
        next(error)
    }
}

export const likeBlog = async (req, res, next) => {
    try {
        const { id_blog } = req.params;

        const blogIsExists = await Blog?.findOne({ 
            where : { 
                id : id_blog
            } 
        });

        if (!blogIsExists) throw (
            { 
                status : errorMiddleware.NOT_FOUND_STATUS, 
                message : errorMiddleware.DATA_NOT_FOUND
            }
        );

        const like_check = await Like?.findAll({
            where: {
                userId: req.user.id,
                blogId: id_blog
            }
        });

        if(like_check.length) throw (
            { 
                status : errorMiddleware.BAD_REQUEST_STATUS, 
                message : errorMiddleware.BLOG_ALREADY_LIKE
            }
        );
        
        const like = await Like?.create({
            userId : req.user.id,
            blogId : id_blog,
            date : moment().format("YYYY-MM-DD HH:mm:ss")
        })

        res.status(200).json({
            type: "success",
            message : "Like Added",
            like
        })
    } catch (error) {
        next(error)
    }
}

export const categoryBlogs = async (req, res, next) =>{
    try {
        const category = await Category?.findAll();

        res.status(200).json(
            { 
                type : "success",
                category 
            }
        )

    } catch (error) {
        next(error)
    }
}

export const favoriteBlogs = async (req, res, next) =>{
    try {
        const { id_cat } = req.query;
        const favorite = await Like?.findAll({
            attributes: [
                'blogId',
                [sequelize.fn('COUNT', sequelize.col(`likes.id`)), 'total_likes'],
            ],
            group : 'blogId',
            include : [
                {
                    model : Blog,
                    where : id_cat ? {categoryId : id_cat} : {},
                }
            ],
            order : [
                ['total_likes','DESC']
            ]
        });

        if(!favorite.length) throw (
            { 
                status : errorMiddleware.NOT_FOUND_STATUS, 
                message : errorMiddleware.DATA_NOT_FOUND
            }
        );

        res.status(200).json({ 
            type : "success",
            favorite 
        })

    } catch (error) {
        next(error)
    }
}

export const userFavoriteBlogs = async (req, res, next) =>{
    try {
        
        const UserFavorite = await Like?.findAll({
            attributes : [
                'blogId',
                [sequelize.fn('COUNT', sequelize.col(`likes.id`)), 'total_likes'],
            ],
            group : 'blogId',
            where :{
                userId : req.user.id
            },
            include : Blog,
        });

        if(!UserFavorite.length) throw (
            { 
                status : errorMiddleware.NOT_FOUND_STATUS, 
                message : errorMiddleware.DATA_NOT_FOUND
            }
        );

        res.status(200).json({ 
            type : "success",
            UserFavorite 
        })

    } catch (error) {
        next(error)
    }
}

export const userBlogs = async (req, res, next) =>{
    try {
        
        const UserBlog = await Blog?.findAll({
            where :{
                userId : req.user.id
            }
        });

        if(!UserBlog.length) throw (
            { 
                status : errorMiddleware.NOT_FOUND_STATUS, 
                message : errorMiddleware.DATA_NOT_FOUND
            }
        );

        res.status(200).json({ 
            type : "success",
            UserBlog 
        })

    } catch (error) {
        next(error)
    }
}

export const getBlogPicture = async (req, res, next) => {
    try {
        const { id_blog } = req.params
        const blog = await Blog?.findOne({ 
            where : { 
                id : id_blog
            } 
        });

        if (!blog) throw ({ 
            status : errorMiddleware.NOT_FOUND_STATUS, 
            message : errorMiddleware.DATA_NOT_FOUND 
        })

        if (!blog.blog_pic) throw ({ 
            type : "error",
            status : errorMiddleware.NOT_FOUND_STATUS, 
            message : "Blog Picture is empty"
        })

        res.status(200).json(config.URL_PIC + blog.blog_pic) //https://res.cloudinary.com/dpgk4f2eu/image/upload/f_auto,q_auto/v1/
    } catch (error) {
        next(error)
    }
}

