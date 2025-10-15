import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // ensures https URLs
});

/**
 * Uploads a file to Cloudinary
 * @param filePath - path to the local file or base64 string
 * @param folder - optional folder name in Cloudinary
 * @returns the uploaded file's URL and public ID
 */
export const uploadToCloudinary = async (filePath: string, folder?: string) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder || "default",
    });
    return { url: result.secure_url, publicId: result.public_id };
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    throw new Error("Failed to upload image to Cloudinary");
  }
};

/**
 * Optional: Delete an image from Cloudinary
 * @param publicId - public ID of the image in Cloudinary
 */
export const deleteFromCloudinary = async (publicId: string) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Cloudinary Delete Error:", error);
    throw new Error("Failed to delete image from Cloudinary");
  }
};
