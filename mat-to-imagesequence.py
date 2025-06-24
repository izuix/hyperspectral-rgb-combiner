import os
import h5py
from PIL import Image
import numpy as np
from tkinter import Tk, filedialog

gamma = 2.2

def processMatfile(file_path):
    # Create an output folder for images
    base_name = os.path.splitext(os.path.basename(file_path))[0].split('_')[-1]
    output_folder = os.path.join(os.path.dirname(file_path), base_name) #output_folder = os.path.join(os.path.dirname(file_path), "output_images")
    os.makedirs(output_folder, exist_ok=True)

    # Process the .mat file
    with h5py.File(file_path, 'r') as h5_data:
        # Extract the hyperspectral data cube and norm_factor
        cube_data = h5_data['cube'][:]  # Load the hyperspectral data cube
        norm_factor = h5_data['norm_factor'][0, 0]  # Normalization factor

        # Normalize and save each band as a grayscale image, rotating to correct orientation if needed
        for i in range(cube_data.shape[0]):
            band_image = cube_data[i, :, :] * norm_factor  # Apply normalization
            band_image_normalized = (band_image - band_image.min()) / (band_image.max() - band_image.min()) * 255
            # Apply gamma correction
            band_image_normalized = (band_image_normalized / 255) ** (1 / gamma) * 255
            
            # Rotate and convert to image
            img = Image.fromarray(band_image_normalized.astype(np.uint8)).rotate(-90, expand=True)
            
            # Save the image
            img_path = os.path.join(output_folder, f'band_{str(i).zfill(2)}.png')
            img.save(img_path)
            print(f'Saved {img_path}')

    print(f"All images saved in folder: {output_folder}")

# Initialize Tkinter and hide the root window
Tk().withdraw()

# Open file dialog to select a .mat file
folder_path = filedialog.askdirectory(
    title="Select the folder containing .mat files"
)
if not folder_path:
    print("No folder path, using script directory")
    folder_path = os.path.dirname(__file__) # script_directory

mat_files = [f for f in os.listdir(folder_path) if f.endswith('.mat')]
if mat_files:
    print(".mat files found")
    # loop through the .mat files in the directory
    for mat_file in mat_files:
        file_path = os.path.join(folder_path, mat_file)
        print("processing mat file ", mat_file)
        processMatfile(file_path)
else:
    print("No .mat file found in the root directory. Exiting.")
    exit()