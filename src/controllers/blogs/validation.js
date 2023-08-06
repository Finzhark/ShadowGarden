import * as Yup from "yup"

export const PublishBlogSchema = Yup.object({
    title: Yup.string()
    .required("Title is required"),
    content: Yup.string()
    .required("Content is required"),
    country: Yup.string()
    .required("Country is required"),
    category: Yup.number()
    .required("Category is required"),
    url: Yup.string(),
    keywords: Yup.string()
    .required("Keywords is required")
});