import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export type User = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "users.json");

function readUsers(): User[] {
  if (!existsSync(DATA_FILE)) return [];
  return JSON.parse(readFileSync(DATA_FILE, "utf8"));
}

function writeUsers(users: User[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), "utf8");
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

export function findUserByUsername(username: string): User | undefined {
  return readUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
}

export function findUserById(id: string): User | undefined {
  return readUsers().find((u) => u.id === id);
}

export function createUser(username: string, email: string, password: string): User {
  const users = readUsers();
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error("username_taken");
  }

  const salt = randomBytes(16).toString("hex");
  const user: User = {
    id: randomUUID(),
    username,
    email,
    passwordHash: hashPassword(password, salt),
    salt,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  writeUsers(users);
  return user;
}

export function verifyPassword(user: User, password: string): boolean {
  const candidate = Buffer.from(hashPassword(password, user.salt));
  const expected = Buffer.from(user.passwordHash);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
