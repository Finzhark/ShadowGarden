import db from "./index.js";

export const Category = db.sequelize.define("categories", {
    id: {
        type: db.Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    name: {
        type : db.Sequelize.STRING(45),
        allowNull : false
    }
},
{ timestamps: false }
);

export const Blog = db.sequelize.define("blogs", {
    id: {
        type: db.Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    createdAt: {
        type: db.Sequelize.DATE,
        allowNull: false
    },
    userId: {
        type: db.Sequelize.INTEGER,
        allowNull : false
    },
    title: {
        type : db.Sequelize.TEXT('medium'),
        allowNull : false
    },
    content : {
        type : db.Sequelize.TEXT('long'),
        allowNull : false
    },
    country : {
        type : db.Sequelize.STRING(45),
        allowNull : false,
    },
    categoryId : {
        type : db.Sequelize.INTEGER,
        allowNull : false,
    },
    url : {
        type : db.Sequelize.STRING(45),
        allowNull : true,
    },
    keywords : {
        type : db.Sequelize.TEXT('medium'),
        allowNull : false,
    },
    blog_pic : {
        type : db.Sequelize.TEXT('long'),
        allowNull : true,
    },
    
},
{ timestamps: false }
)

export const User = db.sequelize.define("users", {
    id: {
        type: db.Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    username: {
        type: db.Sequelize.STRING(45),
        allowNull: false
    },
    email: {
        type : db.Sequelize.STRING(45),
        allowNull : false
    },
    phone : {
        type : db.Sequelize.DOUBLE,
        allowNull : false
    },
    password: {
        type: db.Sequelize.TEXT('long'),
        allowNull : false
    },
    photo_profile : {
        type : db.Sequelize.TEXT('long'),
        allowNull : true
    },
    user_status : {
        type : db.Sequelize.BOOLEAN,
        allowNull : false,
        defaultValue : 0
    },
    verify_token : {
        type : db.Sequelize.TEXT("long"),
        allowNull : true,
    },
    expired_token : {
        type : db.Sequelize.TIME,
        allowNull : true,
    },
},
{ timestamps: false }
)

export const Like = db.sequelize.define("likes", {
    id: {
        type: db.Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    date: {
        type: db.Sequelize.DATE,
        allowNull: false
    },
    blogId: {
        type: db.Sequelize.INTEGER,
        allowNull : false
    },
    userId: {
        type: db.Sequelize.INTEGER,
        allowNull : false
    },
    
},
{ timestamps: false }
)

Blog.belongsTo(Category, {foreignKey : 'categoryId'});
Blog.belongsTo(User, {foreignKey : 'user_id'});
Blog.hasMany(Like);

User.hasMany(Like);
User.hasMany(Blog);

Like.belongsTo(Blog, {foreignKey : 'blog_id'});
Like.belongsTo(User, {foreignKey : 'user_id'});
