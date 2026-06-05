import bcrypt from "bcryptjs";
import {
  createAccessToken,
  createRefreshToken,
  type AuthTokenPayload,
} from "@/server/core/auth";
import { userRepository } from "@/server/repositories/userRepository";

function buildPayload(user: {
  id: string;
  role: "MEMBER" | "ADMIN" | "SUPER_ADMIN";
  email: string;
  branchId: string | null;
}): Omit<AuthTokenPayload, "iat" | "exp"> {
  return {
    sub: user.id,
    role: user.role,
    email: user.email,
    branchId: user.branchId,
  };
}

function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "MB-";
  for (let i = 0; i < 8; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function generateMemberCode(): string {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `MBR-${random}`;
}

export const authService = {
  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(email.toLowerCase());
    if (!user || !user.isActive) {
      return null;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return null;
    }

    const payload = buildPayload(user);
    return {
      user,
      accessToken: createAccessToken(payload),
      refreshToken: createRefreshToken(payload),
    };
  },

  async refresh(refreshTokenPayload: AuthTokenPayload) {
    const user = await userRepository.findById(refreshTokenPayload.sub);
    if (!user || !user.isActive) {
      return null;
    }

    const payload = buildPayload(user);
    return {
      user,
      accessToken: createAccessToken(payload),
      refreshToken: createRefreshToken(payload),
    };
  },

  async me(userId: string) {
    return userRepository.findById(userId);
  },

  async createMemberByAdmin(input: {
    fullName: string;
    email: string;
    phoneNumber?: string;
    branchId?: string;
    actorId?: string;
  }) {
    const exists = await userRepository.findByEmail(input.email.toLowerCase());
    if (exists) {
      throw new Error("Email already in use");
    }

    const tempPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await userRepository.createMember({
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      phoneNumber: input.phoneNumber,
      branchId: input.branchId,
      passwordHash,
      memberCode: generateMemberCode(),
    });
    await userRepository.saveGeneratedPassword({
      userId: user.id,
      password: tempPassword,
      actorId: input.actorId,
    });

    return { user, temporaryPassword: tempPassword };
  },

  async listMembers(branchId?: string) {
    return userRepository.findMembers(branchId);
  },

  async resetPasswordByAdmin(
    memberId: string,
    branchId?: string,
    actorId?: string,
  ) {
    const user = await userRepository.findMemberById(memberId, branchId);
    if (!user) {
      throw new Error("Member not found");
    }

    const tempPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await userRepository.updatePassword(user.id, passwordHash, true);
    await userRepository.saveGeneratedPassword({
      userId: user.id,
      password: tempPassword,
      actorId,
    });

    return { temporaryPassword: tempPassword };
  },

  async updateMemberGeneratedPassword(input: {
    memberId: string;
    password: string;
    branchId?: string;
    actorId?: string;
  }) {
    const user = await userRepository.findMemberById(
      input.memberId,
      input.branchId,
    );
    if (!user) {
      throw new Error("Member not found");
    }

    if (input.password.length < 6) {
      throw new Error("Password minimal 6 karakter");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    await userRepository.updatePassword(user.id, passwordHash, true);
    await userRepository.saveGeneratedPassword({
      userId: user.id,
      password: input.password,
      actorId: input.actorId,
    });

    return { temporaryPassword: input.password };
  },

  async deleteMemberGeneratedPassword(memberId: string, branchId?: string) {
    const user = await userRepository.findMemberById(memberId, branchId);
    if (!user) {
      throw new Error("Member not found");
    }

    await userRepository.deleteGeneratedPassword(user.id);
    return { message: "Generated password deleted" };
  },

  async registerMember(input: {
    fullName: string;
    email: string;
    phoneNumber?: string;
    password: string;
  }) {
    const exists = await userRepository.findByEmail(input.email.toLowerCase());
    if (exists) {
      throw new Error("Email sudah terdaftar");
    }

    if (input.password.length < 6) {
      throw new Error("Password minimal 6 karakter");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await userRepository.createMember({
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      phoneNumber: input.phoneNumber,
      branchId: undefined,
      passwordHash,
      memberCode: generateMemberCode(),
    });

    // Update mustChangePassword to false since user just set their own password
    const updatedUser = await userRepository.findById(user.id);
    if (updatedUser) {
      await userRepository.updatePassword(user.id, user.passwordHash, false);
    }

    return { user: updatedUser || user };
  },

  async changePassword(input: {
    userId: string;
    oldPassword: string;
    newPassword: string;
  }) {
    const user = await userRepository.findById(input.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const valid = await bcrypt.compare(input.oldPassword, user.passwordHash);
    if (!valid) {
      throw new Error("Password lama tidak sesuai");
    }

    if (input.newPassword.length < 6) {
      throw new Error("Password baru minimal 6 karakter");
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 10);
    await userRepository.updatePassword(user.id, passwordHash, false);

    return { message: "Password berhasil diubah" };
  },
};
