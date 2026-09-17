import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");

export const signupSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters")
    .max(40, "Username must be 40 characters or fewer")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores and hyphens",
    ),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: passwordSchema,
  walkingSpeed: z.enum(["accessible", "normal", "fast"]),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  role: z.enum(["student", "admin"]),
});

export type AuthActionState = {
  errors?: {
    username?: string[];
    email?: string[];
    password?: string[];
    walkingSpeed?: string[];
    role?: string[];
  };
  message?: string;
};
