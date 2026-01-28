import Employee from "../models/Employee.model.js";
import ApiError from "../utils/ApiError.js";
import mongoose from "mongoose";

export const getAllEmployees = async (req, res, next) => {
  try {
    const employees = await Employee.find();

    if (!employees) {
      throw new ApiError(404, "Hittade inga anställda");
    }

    res.status(200).json(employees);
  } catch (error) {
    next(error);
  }
};

export const getEmployeeById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ApiError(400, "Ogiltigt ID");
    }

    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      throw new ApiError(404, "Anställd hittades inte");
    }
    res.status(200).json(employee);
  } catch (error) {
    next(error);
  }
};

export const createEmployee = async (req, res, next) => {
  try {
    const existingEmployee = await Employee.findOne({ email: req.body.email });
    if (existingEmployee) {
      throw new ApiError(400, "Denna anställda finns redan");
    }

    const newEmployee = new Employee(req.body);
    const savedEmployee = await newEmployee.save();

    res.status(201).json(savedEmployee);
  } catch (error) {
    next(error);
  }
};

export const updateEmployee = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ApiError(400, "Ogiltigt ID");
    }

    if (req.body.email) {
      const existingEmployee = await Employee.findOne({
        email: req.body.email,
        _id: { $ne: req.params.id },
      });

      if (existingEmployee) {
        throw new ApiError(400, "Denna email finns redan");
      }
    }

    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );

    if (!updatedEmployee) {
      throw new ApiError(404, "Anställd hittades inte");
    }

    res.status(200).json(updatedEmployee);
  } catch (error) {
    next(error);
  }
};

export const deleteEmployee = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ApiError(400, "Ogiltigt ID");
    }

    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      throw new ApiError(404, "Anställd hittades inte");
    }

    if (!employee.active) {
      throw new ApiError(400, "Anställd är redan inaktiv");
    }

    employee.active = false;
    await employee.save();

    res.status(200).json({ message: "Anställd inaktiverad" });
  } catch (error) {
    next(error);
  }
};
