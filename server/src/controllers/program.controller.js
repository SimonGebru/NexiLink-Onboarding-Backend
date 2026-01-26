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
    // const program = await Program.findById(req.params.id).populate("owner");
    const program = await Program.findById(req.params.id); // använder inte populate för tillfället, när alla filer är klara kan vi lägga till det igen

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
    let newProgram = await Program.create({
      ...req.body,
      owner: req.user.id,
    });

    // newProgram = await Program.findById(newProgram._id).populate("owner");
    newProgram = await Program.findById(newProgram._id); // använder inte populate för tillfället, när alla filer är klara kan vi lägga till det igen

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

    if (!program.owner) {
      throw new ApiError(
        400,
        "Program is missing owner (created before auth fix)"
      );
    }

    const isOwner = program.owner.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      throw new ApiError(403, "You do not own this program");
    }

    if (req.body.owner) delete req.body.owner;

    const updatedProgram = await Program.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ); // använder inte populate för tillfället, när alla filer är klara kan vi lägga till det igen

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

    if (!program.owner) {
      throw new ApiError(
        400,
        "Program is missing owner (created before auth fix)"
      );
    }

    const isOwner = program.owner.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      throw new ApiError(403, "Unauthorized to delete this program");
    }

    await program.deleteOne();
    res.json({ message: "Program deleted successfully" });
  } catch (error) {
    next(error);
  }
};
