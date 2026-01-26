import Program from "../models/Program.model.js";
import ApiError from "../utils/ApiError.js";
import mongoose from "mongoose";

// Hämta alla program
export const getAllPrograms = async (req, res, next) => {
  try {
    const programs = await Program.find();

    if (programs.length === 0) {
      throw new ApiError(404, "No programs found");
    }

    res.status(200).json(programs);
  } catch (error) {
    next(error);
  }
};

// Hämta ett specifikt program
export const getProgramById = async (req, res, next) => {
  try {
    const program = await Program.findById(req.params.id).populate("owner");

    if (!program) {
      throw new ApiError(404, "Program not found");
    }
    res.status(200).json(program);
  } catch (error) {
    next(error);
  }
};

// Skapa ett program
export const createProgram = async (req, res, next) => {
  try {
    // Behövs en inloggad/mockad user
    let newProgram = await Program.create({ ...req.body, owner: req.user._id });
    newProgram = await Program.findById(newProgram._id).populate("owner");
    res.status(201).json(newProgram);
  } catch (error) {
    next(error);
  }
};

// Uppdatera program
export const updateProgram = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ApiError(400, "Invalid ID format");
    }

    const program = await Program.findById(req.params.id);

    if (!program) {
      throw new ApiError(404, "Program not found");
    }

    // Utkommenterat tills auth är implementerat

    /* if (program.owner.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Unauthorized to update this program" });
    } */

    if (req.body.owner) {
      delete req.body.owner;
    }

    const updatedProgram = await Program.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      {
        new: true,
        runValidators: true,
      },
    ).populate("owner");

    res.status(200).json(updatedProgram);
  } catch (error) {
    next(error);
  }
};

// Radera ett program
export const deleteProgram = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ApiError(400, "Invalid ID format");
    }

    const program = await Program.findById(req.params.id);

    if (!program) {
      throw new ApiError(404, "Program not found");
    }

    // Utkommenterat till auth är implementerat

    /* if (program.owner.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Unauthorized to delete this program" });
    } */

    await program.deleteOne();

    res.json({ message: "Program deleted successfully" });
  } catch (error) {
    next(error);
  }
};
