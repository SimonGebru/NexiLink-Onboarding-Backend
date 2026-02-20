import Program from "../models/Program.model.js";
import ApiError from "../utils/ApiError.js";
import mongoose from "mongoose";
import { parsers } from "../services/fileParser.js";

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

export const uploadProgramMaterials = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ApiError(400, "Invalid ID format");
    }

    const program = await Program.findById(req.params.id);

    if (!program) {
      throw new ApiError(404, "Program not found");
    }

    const isOwner = program.owner?.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      throw new ApiError(403, "Not authorized");
    }

    // Hanterar ensamma filer och flera filer
    const files = req.files || (req.file ? [req.file] : []);

    if (files.length === 0) {
      throw new ApiError(400, "No files uploaded");
    }

    const parseFile = async (file) => {
      const { originalname, mimetype, buffer, size } = file;

      let parsedContent;
      let isParsed = false;

      for (const parser of parsers) {
        if (mimetype === parser.type) {
          parsedContent = await parser.action(buffer);
          isParsed = true;
          break;
        }
      }

      if (!isParsed) {
        throw new ApiError(400, `Couldnt parse filetype: ${mimetype}`);
      }

      // Normalisera parser-output till extractedText + headings
      let extractedText = "";
      let headings = [];

      // 1) Om parsern returnerar en string => fulltext
      if (typeof parsedContent === "string") {
        extractedText = parsedContent;
      }

      // 2) Om parsern returnerar en array => anta rubriker
      else if (Array.isArray(parsedContent)) {
        headings = parsedContent.filter(Boolean).map(String);
        extractedText = headings.join("\n");
      }

      // 3) Om parsern returnerar objekt => plocka ut text/headings om det finns
      else if (parsedContent && typeof parsedContent === "object") {
        if (typeof parsedContent.text === "string") {
          extractedText = parsedContent.text;
        }
        if (Array.isArray(parsedContent.headings)) {
          headings = parsedContent.headings.filter(Boolean).map(String);
        }

        // Fallback om text saknas men headings finns
        if (!extractedText && headings.length > 0) {
          extractedText = headings.join("\n");
        }

        // Sista fallback: stringify som text (så ni inte tappar allt)
        if (!extractedText) {
          extractedText = JSON.stringify(parsedContent);
        }
      }

      // Bestäm default sourceType för frontend/AI
      const sourceTypeDefault = headings.length > 0 ? "headings" : "fulltext";

      return {
        type: "file",
        title: originalname,
        fileName: originalname,
        mimeType: mimetype,
        size: typeof size === "number" ? size : 0,

        
        extractedText,
        headings,
        sourceTypeDefault,

        
        fileData:
          typeof parsedContent === "string"
            ? parsedContent
            : JSON.stringify(parsedContent),
      };
    };

    const newMaterials = await Promise.all(files.map(parseFile));

    program.materials.push(...newMaterials);
    await program.save();

    res.status(200).json({
      success: true,
      message: `${files.length} file${files.length > 1 ? "s" : ""} uploaded successfully`,
      materials: newMaterials,
    });
  } catch (error) {
    next(error);
  }
};
export const saveChecklistTemplate = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ApiError(400, "Invalid ID format");
    }

    const program = await Program.findById(req.params.id);

    if (!program) {
      throw new ApiError(404, "Program not found");
    }

    const isOwner = program.owner?.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      throw new ApiError(403, "Not authorized");
    }

    const { checklistTitle, items } = req.body;

    if (!checklistTitle || !Array.isArray(items)) {
      throw new ApiError(400, "checklistTitle and items are required");
    }

    // Spara titel + items
    program.checklistTemplateTitle = checklistTitle;
    program.checklistTemplate = items;

    await program.save();

    res.status(200).json({
      success: true,
      checklistTemplateTitle: program.checklistTemplateTitle,
      checklistTemplate: program.checklistTemplate,
    });
  } catch (error) {
    next(error);
  }
};
