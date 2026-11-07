import { and, desc, eq } from "drizzle-orm";
import { applications, users } from "../db/schema";
import { hmac } from "../utils/hash";
import { searchCitizenQuery } from "../validators/user.validators";
import { db } from "../db";
import { AppError } from "../utils/AppError";

export const searchCitizen = async (query: searchCitizenQuery) =>{
    const match = query.nid ? eq(users.nidHash, hmac(query.nid)) : eq(users.phone, query.phone!);

    const citizen = await db.query.users.findFirst({
        where: and(match, eq(users.role, "citizen")),
        columns: {id: true, name: true, phone: true, createdAt: true}
    });

    if(!citizen)throw new AppError(404, "No citizen found");

    const citizenApplications = await db.query.applications.findMany({
        where: eq(applications.userId, citizen.id),
        orderBy: desc(applications.createdAt),
        columns: {id: true, type: true, status: true, brn: true, createdAt: true}
    });

    return{citizen, count:citizenApplications.length, applications: citizenApplications}
}