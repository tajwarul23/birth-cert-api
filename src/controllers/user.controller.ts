import { Request, Response } from "express"
import { searchCitizenSchema } from "../validators/user.validators"
import { AppError } from "../utils/AppError";
import * as userService from "../services/user.service"


export const searchCitizen = async(req: Request, res: Response) =>{
    const query = searchCitizenSchema.safeParse(req.query);
    if(!query.success) throw new AppError(400, "Search with a valid NID or phone number");

    const result = await userService.searchCitizen(query.data);
    res.status(200).json({success:true, data:result})
}