import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import resetAuthState, {
  
  registerUser,
  setRole,
  setFirstName,
  setLastName,
  setEmail,
  setPassword,
  setConfirmPassword,
  setCompanyName,
  setAcceptTerms,
} from "../store/auth/authSlice";
import { toast } from "react-toastify";

const Register = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    role,
    firstName,
    lastName,
    email,
    password,
    confirmPassword,
    companyName,
    acceptTerms,
    loading,
    error,
    isAuthenticated,
    user,
  } = useSelector((state) => state.auth);

  const [formErrors, setFormErrors] = useState({});

  // Reset error state when component mounts
  useEffect(() => {
    dispatch(resetAuthState());
  }, [dispatch]);

  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(user.role === "recruiter" ? "/recrutement" : "/");
    }
  }, [isAuthenticated, user, navigate]);

  const validateForm = () => {
    const errors = {};
    let isValid = true;

    if (!firstName.trim()) {
      errors.firstName = "First name is required";
      isValid = false;
    }

    if (!lastName.trim()) {
      errors.lastName = "Last name is required";
      isValid = false;
    }

    if (!email.trim()) {
      errors.email = "Email is required";
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Email is invalid";
      isValid = false;
    }

    if (!password) {
      errors.password = "Password is required";
      isValid = false;
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
      isValid = false;
    } else if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      errors.password = "Password must include uppercase and number";
      isValid = false;
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords don't match";
      isValid = false;
    }

    if (role === "recruiter" && !companyName.trim()) {
      errors.companyName = "Company name is required";
      isValid = false;
    }

    if (!acceptTerms) {
      errors.acceptTerms = "You must accept the terms";
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const payload = {
      firstName,
      lastName,
      email,
      password,
      acceptTerms,
      role,
      ...(role === "recruiter" && { companyName }),
    };

    try {
      const result = await dispatch(registerUser(payload));
      if (result.meta.requestStatus === "fulfilled") {
        toast.success("Registration successful!");
        dispatch(resetAuthState()); // Clear form
      } else if (result.meta.requestStatus === "rejected") {
        const errorMsg = result.payload?.message || "Registration failed";
        setFormErrors({ server: errorMsg });
        toast.error(errorMsg);
      }
    } catch (err) {
      setFormErrors({ server: "Registration failed. Please try again." });
      toast.error("Registration failed. Please try again.");
    }
  };

  return (
    <section className="bg-gray-50 min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-lg shadow border border-gray-200">
        <div className="p-4 space-y-4 md:p-6 md:space-y-6">
          <h1 className="text-xl font-bold leading-tight tracking-tight text-gray-900 md:text-2xl text-center">
            Create an Account
          </h1>

          {formErrors.server && (
            <p className="text-sm text-red-600 text-center">
              {formErrors.server}
            </p>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-900">
                I am registering as a:
              </label>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => dispatch(setRole("user"))}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium ${
                    role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                  }`}
                >
                  User
                </button>
                <button
                  type="button"
                  onClick={() => dispatch(setRole("recruiter"))}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium ${
                    role === "recruiter"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                  }`}
                >
                  Recruiter
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="firstName"
                  className="block mb-2 text-sm font-medium text-gray-900"
                >
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => dispatch(setFirstName(e.target.value))}
                  className={`bg-gray-50 border ${
                    formErrors.firstName ? "border-red-500" : "border-gray-300"
                  } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                  placeholder="John"
                  required
                  aria-invalid={formErrors.firstName ? "true" : "false"}
                  aria-describedby={
                    formErrors.firstName ? "firstName-error" : undefined
                  }
                />
                {formErrors.firstName && (
                  <p id="firstName-error" className="mt-1 text-sm text-red-600">
                    {formErrors.firstName}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="block mb-2 text-sm font-medium text-gray-900"
                >
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => dispatch(setLastName(e.target.value))}
                  className={`bg-gray-50 border ${
                    formErrors.lastName ? "border-red-500" : "border-gray-300"
                  } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                  placeholder="Doe"
                  required
                  aria-invalid={formErrors.lastName ? "true" : "false"}
                  aria-describedby={
                    formErrors.lastName ? "lastName-error" : undefined
                  }
                />
                {formErrors.lastName && (
                  <p id="lastName-error" className="mt-1 text-sm text-red-600">
                    {formErrors.lastName}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                value={email}
                onChange={(e) => dispatch(setEmail(e.target.value))}
                className={`bg-gray-50 border ${
                  formErrors.email ? "border-red-500" : "border-gray-300"
                } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                placeholder={
                  role === "recruiter"
                    ? "john.doe@company.com"
                    : "john.doe@example.com"
                }
                required
                aria-invalid={formErrors.email ? "true" : "false"}
                aria-describedby={formErrors.email ? "email-error" : undefined}
              />
              {formErrors.email && (
                <p id="email-error" className="mt-1 text-sm text-red-600">
                  {formErrors.email}
                </p>
              )}
            </div>

            {role === "recruiter" && (
              <div>
                <label
                  htmlFor="companyName"
                  className="block mb-2 text-sm font-medium text-gray-900"
                >
                  Company Name
                </label>
                <input
                  type="text"
                  name="companyName"
                  id="companyName"
                  value={companyName}
                  onChange={(e) => dispatch(setCompanyName(e.target.value))}
                  className={`bg-gray-50 border ${
                    formErrors.companyName
                      ? "border-red-500"
                      : "border-gray-300"
                  } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                  placeholder="Tech Corp"
                  required
                  aria-invalid={formErrors.companyName ? "true" : "false"}
                  aria-describedby={
                    formErrors.companyName ? "companyName-error" : undefined
                  }
                />
                {formErrors.companyName && (
                  <p
                    id="companyName-error"
                    className="mt-1 text-sm text-red-600"
                  >
                    {formErrors.companyName}
                  </p>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="password"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Password
              </label>
              <input
                type="password"
                name="password"
                id="password"
                value={password}
                onChange={(e) => dispatch(setPassword(e.target.value))}
                className={`bg-gray-50 border ${
                  formErrors.password ? "border-red-500" : "border-gray-300"
                } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                placeholder="••••••••"
                required
                aria-invalid={formErrors.password ? "true" : "false"}
                aria-describedby={
                  formErrors.password ? "password-error" : undefined
                }
              />
              {formErrors.password && (
                <p id="password-error" className="mt-1 text-sm text-red-600">
                  {formErrors.password}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Must include uppercase and number
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => dispatch(setConfirmPassword(e.target.value))}
                className={`bg-gray-50 border ${
                  formErrors.confirmPassword
                    ? "border-red-500"
                    : "border-gray-300"
                } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                placeholder="••••••••"
                required
                aria-invalid={formErrors.confirmPassword ? "true" : "false"}
                aria-describedby={
                  formErrors.confirmPassword
                    ? "confirmPassword-error"
                    : undefined
                }
              />
              {formErrors.confirmPassword && (
                <p
                  id="confirmPassword-error"
                  className="mt-1 text-sm text-red-600"
                >
                  {formErrors.confirmPassword}
                </p>
              )}
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="terms"
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => dispatch(setAcceptTerms(e.target.checked))}
                  className={`w-4 h-4 rounded ${
                    formErrors.acceptTerms
                      ? "border-red-500"
                      : "border-gray-300"
                  } text-blue-600 focus:ring-blue-500`}
                  required
                  aria-invalid={formErrors.acceptTerms ? "true" : "false"}
                  aria-describedby={
                    formErrors.acceptTerms ? "terms-error" : undefined
                  }
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="terms" className="text-gray-500">
                  I accept the{" "}
                  <Link
                    to="/terms"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Terms and Conditions
                  </Link>{" "}
                  and{" "}
                  <Link
                    to="/privacy"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Privacy Policy
                  </Link>
                </label>
                {formErrors.acceptTerms && (
                  <p id="terms-error" className="mt-1 text-sm text-red-600">
                    {formErrors.acceptTerms}
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center ${
                loading ? "opacity-75 cursor-not-allowed" : ""
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating Account...
                </span>
              ) : (
                `Create ${role === "recruiter" ? "Recruiter" : "User"} Account`
              )}
            </button>

            <p className="text-sm font-light text-gray-500 text-center">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-blue-600 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </section>
  );
};

export default Register;
