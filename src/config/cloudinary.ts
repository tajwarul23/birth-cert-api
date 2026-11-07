import { v2 as cloudinary } from "cloudinary";
import "./env"; 


cloudinary.config({ secure: true });

export default cloudinary;