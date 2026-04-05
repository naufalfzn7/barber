import { prisma } from "@/server/db/prisma";

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  findMembers(branchId?: string) {
    return prisma.user.findMany({
      where: {
        role: "MEMBER",
        ...(branchId ? { branchId } : {}),
      },
      include: {
        memberProfile: {
          select: { memberCode: true, defaultBranchId: true, joinedAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  findAdmins(branchId?: string) {
    return prisma.user.findMany({
      where: {
        role: "ADMIN",
        ...(branchId ? { branchId } : {}),
      },
      include: {
        adminProfile: {
          select: { branchId: true, jobTitle: true },
        },
        branch: {
          select: { id: true, code: true, name: true, timezone: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  findAdminById(adminId: string) {
    return prisma.user.findFirst({
      where: {
        id: adminId,
        role: "ADMIN",
      },
      include: {
        adminProfile: {
          select: { branchId: true, jobTitle: true },
        },
        branch: {
          select: { id: true, code: true, name: true, timezone: true },
        },
      },
    });
  },

  createAdmin(input: {
    fullName: string;
    email: string;
    phoneNumber?: string;
    passwordHash: string;
    branchId: string;
    jobTitle?: string;
  }) {
    return prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        fullName: input.fullName,
        phoneNumber: input.phoneNumber,
        passwordHash: input.passwordHash,
        role: "ADMIN",
        branchId: input.branchId,
        mustChangePassword: true,
        adminProfile: {
          create: {
            branchId: input.branchId,
            jobTitle: input.jobTitle,
          },
        },
      },
    });
  },

  updateAdmin(input: {
    adminId: string;
    fullName?: string;
    email?: string;
    phoneNumber?: string | null;
    branchId?: string | null;
    isActive?: boolean;
    jobTitle?: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: input.adminId },
        data: {
          ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
          ...(input.email !== undefined
            ? { email: input.email.toLowerCase() }
            : {}),
          ...(input.phoneNumber !== undefined
            ? { phoneNumber: input.phoneNumber }
            : {}),
          ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });

      await tx.adminProfile.updateMany({
        where: { userId: input.adminId },
        data: {
          ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
          ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
        },
      });

      return user;
    });
  },

  findMemberById(memberId: string, branchId?: string) {
    return prisma.user.findFirst({
      where: {
        id: memberId,
        role: "MEMBER",
        ...(branchId ? { branchId } : {}),
      },
    });
  },

  createMember(input: {
    email: string;
    fullName: string;
    phoneNumber?: string;
    passwordHash: string;
    branchId?: string;
    memberCode: string;
  }) {
    return prisma.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        phoneNumber: input.phoneNumber,
        passwordHash: input.passwordHash,
        role: "MEMBER",
        branchId: input.branchId,
        mustChangePassword: true,
        memberProfile: {
          create: {
            memberCode: input.memberCode,
            defaultBranchId: input.branchId,
          },
        },
      },
    });
  },

  updatePassword(
    userId: string,
    passwordHash: string,
    mustChangePassword: boolean,
  ) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword },
    });
  },

  updateMember(
    userId: string,
    input: {
      fullName?: string;
      email?: string;
      phoneNumber?: string | null;
    },
  ) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.email !== undefined
          ? { email: input.email.toLowerCase() }
          : {}),
        ...(input.phoneNumber !== undefined
          ? { phoneNumber: input.phoneNumber }
          : {}),
      },
    });
  },
};
