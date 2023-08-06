import { Router } from "express"
import verifyUser from "../../middlewares/token.verify.js"
import * as BlogControllers from "./index.js"
import { createCloudinaryStorage, createUploader } from "../../helpers/uploader.js"

const storage = createCloudinaryStorage("picture-blog")
const uploader = createUploader(storage)
const router = Router()

router.get("/", BlogControllers.getBlogs)
router.post("/publish_blog", verifyUser, uploader.single("file"), BlogControllers.publishBlog) 
router.patch("/delete/:id_blog", verifyUser, BlogControllers.deleteBlogs)
router.post("/like_blog/:id_blog",verifyUser, BlogControllers.likeBlog)
router.get("/category_blog", BlogControllers.categoryBlogs)
router.get("/favorite_blog", BlogControllers.favoriteBlogs)
router.get("/favorite_blog/user", verifyUser, BlogControllers.userFavoriteBlogs)
router.get("/user", verifyUser, BlogControllers.userBlogs)
router.get("/blog_picture/:id_blog", BlogControllers.getBlogPicture)

export default router