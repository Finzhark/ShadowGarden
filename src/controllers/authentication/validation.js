import * as Yup from "yup"
import YupPassword from 'yup-password';
YupPassword(Yup);

export const RegisterValidationSchema = Yup.object({
    username : Yup.string().required("Username is required"),
    password : Yup.string()
        .required("Password is required")
        .min(6, 'password must contain 6 or more characters with at least one of each: uppercase, special character')
        .minUppercase(1, 'password must contain at least 1 upper case letter')
        .minSymbols(1, 'password must contain at least 1 special character'),
    email : Yup.string().email("Invalid email").required("Email is required"),
    phone : Yup.string().required("Phone is required")
})

export const LoginValidationSchema = Yup.object({
    username : Yup.string().required("Username is required"),
    password : Yup.string().required("Password is required")
})

export const EmailValidationSchema = Yup.object({
    email : Yup.string().email("Invalid email").required("Email is required")
})

export const IsEmail = async (email) => {
    return await EmailValidationSchema.isValid({ email })
}

export const changePasswordSchema = Yup.object({
  currentPassword: Yup.string()
    .required("Password is required"),
  newPassword: Yup.string()
    .required("Password is required")
    .notOneOf([Yup.ref('currentPassword')],"New and Current Password can't be the same")
    .min(6, 'password must contain 6 or more characters with at least one of each: uppercase, special character')
    .minUppercase(1, 'password must contain at least 1 upper case letter')
    .minSymbols(1, 'password must contain at least 1 special character'),
  confirmPassword: Yup.string()
    .required("Password is required")
    .oneOf([Yup.ref('newPassword'), null], 'Must match "New Password" field value'),
});

export const changeUsernameSchema = Yup.object().shape({
  username : Yup.string()
  .min(5,'Username minimum 5 characters'),
});

export const changePhoneSchema = Yup.object().shape({
  phone: Yup.string()
    .matches(/[0-9]/,'phone must be a number')
    .matches(/0[0-9]/,'phone must be a number and start with 0')
    .min(10,'phone must contain 10 or more digits'),
});

export const resetPasswordSchema = Yup.object().shape({
  password: Yup.string()
    .required("Password is required")
    .min(6, 'password must contain 6 or more characters with at least one of each: uppercase, special character')
    .minUppercase(1, 'password must contain at least 1 upper case letter')
    .minSymbols(1, 'password must contain at least 1 special character'),
  confirm: Yup.string()
    .required("Password is required")
    .oneOf([Yup.ref('password'), null], 'Must match "password" field value'),
});
