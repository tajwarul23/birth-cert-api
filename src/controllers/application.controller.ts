import { Request, Response } from "express";
import { AppError } from "../utils/AppError";
import {
  correctionFormSchema,
  newApplicationFormSchema,
} from "../validators/application.validators";
import { UploadedFiles } from "../services/application.service";
import * as applicationService from "../services/application.service";

export const createNew = async (req: Request, res: Response) => {
  let data: unknown;

  try {
    data = JSON.parse(req.body.data);
  } catch (error) {
    throw new AppError(
      400,
      "Send the form as valid JSON in a text field named - data",
    );
  }

  const form = newApplicationFormSchema.parse(data);
  const files = (req.files ?? {}) as UploadedFiles;

  const application = await applicationService.createNewApplication(
    req.user!.id,
    form,
    files,
  );

  res
    .status(201)
    .json({
      success: true,
      message: "Application submitted",
      data: { application },
    });
};

export const createCorrection = async (req: Request, res: Response) => {
  let data: unknown;

  try {
    data = JSON.parse(req.body.data);
  } catch (error) {
    throw new AppError(
      400,
      "Send the form as valid JSON in a text field named - data",
    );
  }
  const form = correctionFormSchema.parse(data);
  const files = (req.files ?? {}) as UploadedFiles;
  const application = await applicationService.createCorrection(
    req.user!.id,
    form,
    files,
  );
  res
    .status(201)
    .json({
      success: true,
      message: "Correction submitted",
      data: { application },
    });
};

export const getMyApplications = async (req: Request, res: Response) => {
  const allApplications = await applicationService.getMyApplications(
    req.user!.id,
  );
  res
    .status(200)
    .json({
      success: true,
      message: "All applications fetched",
      data: { count: allApplications.length, applications: allApplications },
    });
};
