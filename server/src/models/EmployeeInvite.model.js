import mongoose from "mongoose";

const employeeInviteSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    usedAt: {
      type: Date,
      default: null,
      index: true,
    },

    invitedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

// Kollar om en inbjudan går att använda eller inte
employeeInviteSchema.virtual("isActive").get(function () {
  if (this.usedAt) return false;
  if (!this.expiresAt) return false;
  return Date.now() < new Date(this.expiresAt).getTime();
});


export default mongoose.model("EmployeeInvite", employeeInviteSchema);
