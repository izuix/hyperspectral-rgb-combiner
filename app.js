let imageFiles = [];
let startWavelength = 400;
let endWavelength = 700;

let Settings = {
	baseWavelength: 550,
	wavelengthSpread: 75,
	redWavelength: 625,
	greenWavelength: 550,
	blueWavelength: 475,
	saturation: 1,
	whiteBalanceAB: 0,
	whiteBalanceGM: 0,
}

let dataDirectory = ".\data";
// imageFiles = dataDirectory[0]
// each entry in the dataDirectory is a sequence of wavelength images.
// Contains an array of imageFiles arrays if you will.
// should go to next/previous with onscreen buttons or keys [0] --> [1] etc
// (tbd what is more convenient, 
// keys might conflict with existing sliders that can be incremented with keys)
// should stay compatible with fileInput functionality

fileInput.onchange = function () {
	if (confirm("replace settings?")) {
		startWavelength = window.prompt("start wavelength", 400);
		endWavelength = window.prompt("end wavelength", 700);
		material.uniforms.monochrome.value = confirm("monochrome?"); // prompts a boolean. Disables the rgb->bw code in the shader if true

		//console.log(startWavelength, endWavelength);

		// set sliders wavelength range
		sliders = document.querySelectorAll(".slider-container")
		for (i = 0; i < sliders.length - 3; i++) { // '- 3' so it doesn't apply to the color balance and saturation sliders
			const node = sliders[i].querySelector("input");
			//console.log(node, sliders[i])
			//node.value = remap(node.value, startWavelength, endWavelength, node.min, node.max);
			if (node.id === "spreadSlider") {
				//console.log("spread");
				node.min = 0;
				node.max = (endWavelength - startWavelength) / 2;
				node.value = node.max / 2;
			} else {
				node.min = startWavelength;
				node.max = endWavelength;
				node.value = (node.min + node.max) / 2;
				//console.log(node.min, node.max)
			}
		}
	}
}

// Initialize Three.js scene, camera, and renderer
const scene = new THREE.Scene();
// const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
	// Replace the camera initialization with:
const camera = new THREE.OrthographicCamera();

// Add this function to update camera frustum
function updateCameraFrustum() {
	const aspect = window.innerWidth / (window.innerHeight * 0.9);
	const frustumHeight = 2;
	const frustumWidth = frustumHeight * aspect;
	
	camera.left = -frustumWidth / 2;
	camera.right = frustumWidth / 2;
	camera.top = frustumHeight / 2;
	camera.bottom = -frustumHeight / 2;
	camera.near = 0.1;
	camera.far = 10;
	camera.updateProjectionMatrix();
}
	//
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas') });
renderer.setSize(window.innerWidth, window.innerHeight * 0.9);

// Add after camera initialization
updateCameraFrustum();

// Create a plane for our image
const geometry = new THREE.PlaneGeometry(2, 2);
const material = new THREE.ShaderMaterial({
	uniforms: {
		imageR: { value: null },
		imageG: { value: null },
		imageB: { value: null },
		saturation: { value: 1.0 },
		whiteBalanceAB: { value: 0.0 },
		whiteBalanceGM: { value: 0.0 },
		monochrome: { value: false }
	},
	vertexShader: `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}
	`,
	fragmentShader: `
		uniform sampler2D imageR;
		uniform sampler2D imageG;
		uniform sampler2D imageB;
		varying vec2 vUv;

		uniform bool monochrome;
		uniform float saturation;
		uniform float whiteBalanceAB;
		uniform float whiteBalanceGM;
		
		#define PI = 3.1415926535897932
		#define smoothGain(x, b) b*x/(b*abs(x)-abs(x)+1.)

		float screen(float a, float b) {
			return a + b - a * b;
		}

		vec3 adjustSaturation(vec3 color, float sat) {
			float grey = dot(color, vec3(0.299, 0.587, 0.114)); // Luma-based grayscale
			vec3 chroma = color - grey;
			return grey + smoothGain(chroma, sat);
		}

		vec3 rgbToYuv(vec3 rgb) {
			float luma = rgb.g;
			float blueness = rgb.b - luma;
			float redness = rgb.r - luma;
			return vec3(luma, redness, blueness);
		}

		vec3 yuvToRgb(vec3 yuv) {
			float green = yuv.x;
			float red = yuv.y + green;
			float blue = yuv.z + green;
			return vec3(red, green, blue);
		}

		vec3 whiteBalanceColor(vec2 uv) {
			float epsilon = 1e-4;
			//float angle = -PI/4.;
			
			uv.y *= -1.; // flip vertically
			
			//uv *= mat2( cos(angle), -sin(angle), sin(angle), cos(angle) );
			uv *= mat2( 0.707107, 0.707107, -0.707107, 0.707107 ); // -45 degrees rotation matrix
			vec3 col = yuvToRgb(vec3(0.5, uv*epsilon));
			col = adjustSaturation(col, 1./epsilon);
			return normalize(col) * 2.;
		}

		void main() {
			float r, g, b;
			if (monochrome) {
				r = texture2D(imageR, vUv).r;
				g = texture2D(imageG, vUv).r;
				b = texture2D(imageB, vUv).r;
			} else {
				vec3 inputRed = texture2D(imageR, vUv).rgb;
				vec3 inputGreen = texture2D(imageG, vUv).rgb;
				vec3 inputBlue = texture2D(imageB, vUv).rgb;
				r = screen(inputRed.r, screen(inputRed.g, inputRed.b)); // only use luma
				g = screen(inputGreen.r, screen(inputGreen.g, inputGreen.b)); // only use luma
				b = screen(inputBlue.r, screen(inputBlue.g, inputBlue.b)); // only use luma
			}
			
			vec3 color = vec3(r, g, b);
			vec3 multiplier = whiteBalanceColor(vec2(whiteBalanceAB, whiteBalanceGM));
			color = smoothGain(color, multiplier);
			color = adjustSaturation(color, saturation);

			gl_FragColor = vec4(color, 1.0);
		}
	`
});
const plane = new THREE.Mesh(geometry, material);
scene.add(plane);

camera.position.z = 1;

function remap(value, lowOut, highOut, lowIn, highIn) {
	return lowOut + (value - lowIn) * (highOut - lowOut) / (highIn - lowIn);
}
function clip(value, minV, maxV) {
	return Math.min(Math.max(value, minV), maxV);
}

function wavelengthToIndex(wavelength) {
	//console.log(wavelength);
	return Math.round( remap(wavelength, 1, imageFiles.length, startWavelength, endWavelength) - 1 );
}

function updatePlaneGeometry(texture) {
	if (!texture || !texture.image) return;
	
	const imageAspect = texture.image.width / texture.image.height;
	const screenAspect = window.innerWidth / (window.innerHeight * 0.9);
	
	let width, height;
	if (screenAspect > imageAspect) {
		// Screen is wider than image
		height = 2;
		width = height * imageAspect;
	} else {
		// Screen is taller than image
		width = 2;
		height = width / imageAspect;
	}
	
	plane.geometry.dispose();
	plane.geometry = new THREE.PlaneGeometry(width, height);
}

function loadImageAtWavelength(wavelength, uniformName) {
	const index = wavelengthToIndex(wavelength);
	//console.log(index);
	const file = imageFiles[index];
	//console.log(file);
	if (!file) {
		console.warn("Invalid file at wavelength:", wavelength, "Index:", index);
		return; // Skip loading if file is not valid
	}
	const loader = new THREE.TextureLoader();
	loader.load(URL.createObjectURL(file), (texture) => {
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		material.uniforms[uniformName].value = texture;
		
		// Only update geometry on green channel (or first loaded texture)
		if (uniformName === 'imageG' || !material.uniforms.imageG.value) {
			updatePlaneGeometry(texture);
		}
	});
}

// joinked from: https://www.en.silicann.com/blog/post/wavelength-color/
function wavelengthToRGB(wavelength) {
	let R = 0
	let G = 0
	let B = 0

	// core translation into color
	if (wavelength >= 380 && wavelength <= 440) {
		R = -1*(wavelength-440)/(440-380)
		G = 0
		B = 1
	} else 
	if (wavelength > 440 && wavelength <= 490) {
		R = 0
		G = (wavelength-440)/(490-440)
		B = 1
	} else 
	if (wavelength > 490 && wavelength <= 510) {
		R = 0
		G = 1
		B = -1*(wavelength-510)/(510-490)
	} else 
	if (wavelength > 510 && wavelength <= 580) {
		R = (wavelength-510)/(580-510)
		G = 1
		B = 0
	} else 
	if (wavelength > 580 && wavelength <= 645) {
		R = 1
		G = -1*(wavelength-645)/(645-580)
		B = 0
	} else 
	if (wavelength > 645 && wavelength <= 780) {
		R = 1
		G = 0
		B = 0
	}


	// intensity adjustment near the vision limits
	let intensity = 1
	if (wavelength >= 700) {
		intensity = 0.3 + 0.7*(780-wavelength)/(780-700)
	} else
	if (wavelength < 420) {
		intensity = 0.3 + 0.7*(wavelength-380)/(420-380)
	}
	//console.log("intensity:", intensity)


	return [
		Math.round(R*255),
		Math.round(G*255),
		Math.round(B*255),
		intensity
	]
}

// (replace with text input?)
function updateSliders() {
	document.getElementById('baseSlider').value = Settings.baseWavelength;
	document.getElementById('spread').value = Settings.wavelengthSpread;
	document.getElementById('redSlider').value = Settings.redWavelength;
	document.getElementById('greenSlider').value = Settings.greenWavelength;
	document.getElementById('blueSlider').value = Settings.blueWavelength;
	// and slider numbers
	document.getElementById('baseWavelength').textContent = Settings.baseWavelength.toFixed(1);
	document.getElementById('spread').textContent = Settings.wavelengthSpread.toFixed(1);
	document.getElementById('redWavelength').textContent = Settings.redWavelength.toFixed(1);
	document.getElementById('greenWavelength').textContent = Settings.greenWavelength.toFixed(1);
	document.getElementById('blueWavelength').textContent = Settings.blueWavelength.toFixed(1);
}

function updateSettings() {
	// Settings from Sliders
	Settings.redWavelength = parseFloat(document.getElementById('redSlider').value);
	Settings.greenWavelength = parseFloat(document.getElementById('greenSlider').value);
	Settings.blueWavelength = parseFloat(document.getElementById('blueSlider').value);
	// Update base to average of R, G, B
	Settings.baseWavelength = (Settings.redWavelength + Settings.greenWavelength + Settings.blueWavelength) / 3;

	//Settings.saturation = parseFloat(document.getElementById('saturationSlider').value);
	
	updateSliders()
}

function updateImages(updateSettingsToo = true) {
	if (updateSettingsToo) {
		updateSettings();
	}

	loadImageAtWavelength(Settings.redWavelength, 'imageR');
	loadImageAtWavelength(Settings.greenWavelength, 'imageG');
	loadImageAtWavelength(Settings.blueWavelength, 'imageB');

	function wavelengthToCSS(elementID, wavelength) {
		const color = wavelengthToRGB(wavelength);
		// generated wavelength color to css color
		document.getElementById(elementID).style.color = `rgba(${color.join(",")})`;
		//console.log(color);
	}
	wavelengthToCSS("basePreview", Settings.baseWavelength);
	wavelengthToCSS("redPreview", Settings.redWavelength);
	wavelengthToCSS("greenPreview", Settings.greenWavelength);
	wavelengthToCSS("bluePreview", Settings.blueWavelength);
}

function updateBaseAndSpread() {
	// Settings from Sliders
	Settings.baseWavelength = parseFloat(document.getElementById('baseSlider').value);
	Settings.wavelengthSpread = parseFloat(document.getElementById('spreadSlider').value);

	Settings.redWavelength = Math.min(endWavelength, Settings.baseWavelength + Settings.wavelengthSpread);
	Settings.greenWavelength = Settings.baseWavelength;
	Settings.blueWavelength = Math.max(startWavelength, Settings.baseWavelength - Settings.wavelengthSpread);

	updateSliders();
	updateImages(false);
}

function resetSaturation() {
	// Reset saturation to 1 (default)
	Settings.saturation = 1.0;
	saturationSlider.value = 1.0;
	document.getElementById('saturationValue').textContent = '1.00';
	material.uniforms.saturation.value = 1.0;  // Update the shader uniform
}
document.getElementById('resetSaturationButton').addEventListener('click', resetSaturation);

function resetWhiteBalance() {
	// Reset whitebalance to 0 (default)
	Settings.whiteBalanceAB = 0.0;
	ABSlider.value = 0.0;
	document.getElementById('ABValue').textContent = '0.00';
	material.uniforms.whiteBalanceAB.value = 0.0;  // Update the shader uniform
	Settings.whiteBalanceGM = 0.0;
	GMSlider.value = 0.0;
	document.getElementById('GMValue').textContent = '0.00';
	material.uniforms.whiteBalanceGM.value = 0.0;  // Update the shader uniform
}
document.getElementById('resetWhitebalanceButton').addEventListener('click', resetWhiteBalance);

function randomizeRGB() {
	const redSlider = document.getElementById('redSlider');
	const greenSlider = document.getElementById('greenSlider');
	const blueSlider = document.getElementById('blueSlider');

	// Generate random values within the range
	function randomWavelength() {
		return Math.floor(Math.random() * (parseFloat(endWavelength) - parseFloat(startWavelength) + 1)) + parseFloat(startWavelength);
	}
	const RGBWavelengths = [];
	for (let i = 0; i < 3; i++) {
		RGBWavelengths[i] = randomWavelength();
	}
	// Red has the largest wavelength, blue the shortest
	RGBWavelengths.sort();
	console.log(RGBWavelengths);

	Settings.redWavelength = RGBWavelengths[2];
	Settings.greenWavelength = RGBWavelengths[1];
	Settings.blueWavelength = RGBWavelengths[0];

	redSlider.value = RGBWavelengths[2];
	greenSlider.value = RGBWavelengths[1];
	blueSlider.value = RGBWavelengths[0];

	//resetSaturation();
	//resetWhiteBalance();

	// Update the displayed values and the image
	updateImages();  // This will update the image based on new random slider values
}
document.getElementById('randomizeButton').addEventListener('click', randomizeRGB);

function hideControlPanel() {
	const controls = document.getElementById('controls');
	controls.classList.toggle('hide');
	const hiddenVisArea = document.getElementById('independent');
	hiddenVisArea.classList.toggle('hide');
	//visibilityButton.classList.remove('hide');
	console.log('hide');
}
document.getElementById('visibilityButton1').addEventListener('click', hideControlPanel);
document.getElementById('visibilityButton0').addEventListener('click', hideControlPanel);

/**
 * 
 * @param {number} x saturationValue
 * @returns 
 */
function mapSaturation(x) {
	return Math.pow(2, x) - 1; // x / (2 - x);
}

document.getElementById('saturationSlider').addEventListener('input', function() {
	Settings.saturation = parseFloat(this.value);
	document.getElementById('saturationValue').textContent = mapSaturation(Settings.saturation).toPrecision(3);
	material.uniforms.saturation.value = mapSaturation(Settings.saturation);
});
document.getElementById('ABSlider').addEventListener('input', function() {
	Settings.whiteBalanceAB = parseFloat(this.value);
	document.getElementById('ABValue').textContent = Settings.whiteBalanceAB.toFixed(3);
	material.uniforms.whiteBalanceAB.value = Settings.whiteBalanceAB;
});
document.getElementById('GMSlider').addEventListener('input', function() {
	Settings.whiteBalanceGM = parseFloat(this.value);
	document.getElementById('GMValue').textContent = Settings.whiteBalanceGM.toFixed(3);
	material.uniforms.whiteBalanceGM.value = Settings.whiteBalanceGM;
});


// input
let inputFolderName = "";
document.getElementById('fileInput').addEventListener('change', (event) => {
	if (!confirm("single folder?")) {
		console.log(event.target);
	}
	inputFolderName = (event.target.files[0].webkitRelativePath).split('/')[0];
	console.log(inputFolderName);
	imageFiles = Array.from(event.target.files).filter(file => 
		file.name.endsWith('.png') || file.name.endsWith('.jpg') || 
		file.name.endsWith('.tif') || file.name.endsWith('.tiff')
	).sort((a, b) => a.name.localeCompare(b.name));

	if (imageFiles.length > 0) {
		updateImages();
	}
});

// output
// Function to save the canvas as an image
function saveImage() {
	const canvas = document.getElementById('canvas');
	const link = document.createElement('a');

	// Get current settings
	const red = Settings.redWavelength;
	const green = Settings.greenWavelength;
	const blue = Settings.blueWavelength;

	// Create a filename with slider values
	const filename = `${inputFolderName}_R${red}nm_G${green}nm_B${blue}nm.png`;

	// Force renderer to render the current frame
	renderer.render(scene, camera);

	// Convert canvas to an image and download
	link.download = filename;
	link.href = canvas.toDataURL('image/png');
	link.click();
}
document.getElementById('saveButton').addEventListener('click', saveImage);


// Update images only on 'change' event (after releasing slider)
document.getElementById('redSlider').addEventListener('input', updateImages);  // Immediate update

document.getElementById('greenSlider').addEventListener('input', updateImages);

document.getElementById('blueSlider').addEventListener('input', updateImages);


// Update base and spread on 'change' event
document.getElementById('baseSlider').addEventListener('change', updateBaseAndSpread);
document.getElementById('spreadSlider').addEventListener('change', updateBaseAndSpread);


document.getElementById('redSlider').min = startWavelength;
document.getElementById('redSlider').max = endWavelength;
document.getElementById('greenSlider').min = startWavelength;
document.getElementById('greenSlider').max = endWavelength;
document.getElementById('blueSlider').min = startWavelength;
document.getElementById('blueSlider').max = endWavelength;


// Animation loop
function animate() {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
}
animate();

// Handle window resizing
window.addEventListener('resize', () => {
	renderer.setSize(window.innerWidth, window.innerHeight * 0.9);
	updateCameraFrustum();
	
	// If we have a texture loaded, update geometry
	if (material.uniforms.imageG.value) {
		updatePlaneGeometry(material.uniforms.imageG.value);
	}
});


// Add export settings button next to save button
const exportButton = document.createElement('button');
exportButton.id = 'exportButton';
exportButton.textContent = 'Export Settings';
exportButton.className = 'control-button';
document.getElementById('saveButton').after(exportButton);

// Add import settings button
const importButton = document.createElement('button');
importButton.id = 'importButton';
importButton.textContent = 'Import Settings';
importButton.className = 'control-button';
document.getElementById('exportButton').after(importButton);

// Hidden file input for importing settings
const settingsInput = document.createElement('input');
settingsInput.type = 'file';
settingsInput.id = 'settingsInput';
settingsInput.accept = '.json';
settingsInput.style.display = 'none';
document.body.appendChild(settingsInput);

// Export settings function
function exportSettings() {
    const settingsJSON = JSON.stringify(Settings, null, 2);
    const blob = new Blob([settingsJSON], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `${inputFolderName}_settings.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
}

// Import settings function
function importSettings(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedSettings = JSON.parse(e.target.result);
            
            // Update Settings object
            Object.assign(Settings, importedSettings);
            
            // Update UI
            updateSliders();
            
            // Update shader uniforms
            material.uniforms.saturation.value = mapSaturation(Settings.saturation);
            material.uniforms.whiteBalanceAB.value = Settings.whiteBalanceAB;
            material.uniforms.whiteBalanceGM.value = Settings.whiteBalanceGM;
            
            // Update displayed values
            document.getElementById('saturationValue').textContent = mapSaturation(Settings.saturation).toPrecision(3);
            document.getElementById('ABValue').textContent = Settings.whiteBalanceAB.toFixed(3);
            document.getElementById('GMValue').textContent = Settings.whiteBalanceGM.toFixed(3);
            
            // Update images
            updateImages();
            
        } catch (error) {
            console.error('Error importing settings:', error);
            alert('Invalid settings file');
        }
    };
    reader.readAsText(file);
}

// Event listeners
exportButton.addEventListener('click', exportSettings);
importButton.addEventListener('click', () => settingsInput.click());
settingsInput.addEventListener('change', (event) => {
    if (event.target.files.length > 0) {
        importSettings(event.target.files[0]);
    }
    // Reset input so the same file can be selected again
    event.target.value = '';
});