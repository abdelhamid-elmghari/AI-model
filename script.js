    let closePopup = document.querySelector("#close-popup");
    closePopup.addEventListener("click", () => {
        document.querySelector(".popup").classList.add("popup-none");
    })
    let letsgo = document.querySelector(".letsgo");
    letsgo.addEventListener("click", () => {
        letsgo.classList.add("disply-none");
        let original = document.querySelector(".original");
        let controls = document.querySelector(".controls");
        original.classList.add("transform-Y");
        controls.classList.add("transform-Y");

    })

    const URL = "https://teachablemachine.withgoogle.com/models/8AtxEMNrW/";

    let model, webcam, labelContainer, maxPredictions;
    let running = false;
    let rafId = null;

    function generatEmojis(emotion) {
        switch (emotion.toLowerCase()) {
            case "happy":
                return "😄 😃 😊 😁";
            case "sad":
                return "😢 😞 😭 💔";
            case "angry":
                return "😠 😡 🤬";
            case "surprise":
                return "😲 😯 😮";
            case "fear":
                return "😨 😱 😖";
            case "neutral":
                return "😐 😑";
            case "disgust":
                return "🤢 🤮 😖";
            default:
                return "ERROR";
        }
    }
    // Load the image model and setup the webcam
    async function init() {
        const modelURL = URL + "model.json";
        const metadataURL = URL + "metadata.json";

        // load the model and metadata
        model = await tmImage.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();

        // prepare label container
        labelContainer = document.getElementById("label-container");
        labelContainer.innerHTML = '';
        for (let i = 0; i < maxPredictions; i++) { // and class labels
            labelContainer.appendChild(document.createElement("div"));
        }

        document.getElementById('status').textContent = 'Model loaded';

        // Convenience function to setup a webcam
        const flip = true; // whether to flip the webcam
        webcam = new tmImage.Webcam(200, 200, flip); // width, height, flip
        await webcam.setup(); // request access to the webcam
        await webcam.play();

        // append elements to the DOM
        const wc = document.getElementById("webcam-container");
        wc.innerHTML = '';
        wc.appendChild(webcam.canvas);

        document.getElementById('toggle-btn').disabled = false;
        document.getElementById('predict-btn').disabled = false;
        document.getElementById('snapshot-btn').disabled = false;
        document.getElementById('upload-img').disabled = false;

        running = true;
        loop();
    }

    async function loop() {
        if (!running) return;
        webcam.update(); // update the webcam frame
        await predictOnCanvas(webcam.canvas);
        rafId = window.requestAnimationFrame(loop);
    }

    // run the given canvas or image through the image model
    async function predictOnCanvas(canvasOrImage) {
        if (!model) return;
        let maxClass = ""

        const prediction = await model.predict(canvasOrImage);
        let max = prediction[0].probability.toFixed(2);
        for (let i = 0; i < maxPredictions; i++) {

            const classPrediction =
                prediction[i].className + ": " + prediction[i].probability.toFixed(2);
            // 1. Create the span element
            labelContainer.childNodes[i].innerHTML = ` <span class="element"></span>${classPrediction}`;

            // 2. Get the span you just created
            const span = labelContainer.childNodes[i].querySelector(".element");

            // 3. Set the width

            span.style.width = `${prediction[i].probability * 100}%`; // works now

            if (prediction[i].probability > max) {
                maxClass = prediction[i].className


            }


        }
        document.querySelector(".the-resume").innerHTML = `<h1 class="high"> High confidence detected <span class="high-class">${maxClass} ${generatEmojis(maxClass) }</span></h1>`


    }

    async function predictOnce() {
        document.getElementById('status').textContent = 'Predicting...';
        if (webcam && webcam.canvas) {
            await predictOnCanvas(webcam.canvas);
        } else {
            document.getElementById('status').textContent = 'No webcam available';
            return;
        }
        document.getElementById('status').textContent = 'Done';
    }

    function toggleWebcam() {
        const btn = document.getElementById('toggle-btn');
        if (!webcam) return;
        if (running) {
            running = false;
            if (rafId) cancelAnimationFrame(rafId);
            try {
                webcam.stop();
            } catch (e) { /* ignore */ }
            btn.textContent = 'Resume';
            document.getElementById('status').textContent = 'Paused';
        } else {
            (async() => {
                running = true;
                try {
                    await webcam.play();
                } catch (e) {
                    console.warn(e);
                }
                btn.textContent = 'Pause';
                document.getElementById('status').textContent = 'Running';
                loop();
            })();
        }
    }

    function takeSnapshot() {
        if (!webcam || !webcam.canvas) return;
        const data = webcam.canvas.toDataURL('image/png');
        const img = document.createElement('img');
        img.src = data;
        document.getElementById('snapshots').appendChild(img);
    }

    function handleUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            alert("Please upload an image file");
            return;
        }

        const snapshots = document.querySelector('#snapshots');
        snapshots.innerHTML = ""; // clear previous

        // Try createObjectURL first (fast, memory-managed)
        if (window.URL && URL.createObjectURL) {
            const imageURL = URL.createObjectURL(file);
            const img = document.createElement('img');
            img.style.maxWidth = '320px';
            img.style.display = 'block';

            // Revoke only after load or error
            img.onload = async() => {
                snapshots.appendChild(img);
                try {
                    await predictOnCanvas(img);
                    console.log(img)
                } catch (err) { console.error(err); }
                URL.revokeObjectURL(imageURL);
            };

            img.onerror = () => {
                // in case of error, revoke and fallback to FileReader
                URL.revokeObjectURL(imageURL);
                readWithFileReader(file, snapshots);
            };

            img.src = imageURL;
            return;
        }

        // Fallback: FileReader (works everywhere)
        readWithFileReader(file, snapshots);
    }

    function readWithFileReader(file, snapshots) {
        const reader = new FileReader();
        const img = document.createElement('img');
        img.style.maxWidth = '320px';
        img.style.display = 'block';

        reader.onload = async(ev) => {
            img.src = ev.target.result;
            snapshots.appendChild(img);
            try { await predictOnCanvas(img); } catch (err) { console.error(err); }
        };

        reader.onerror = (err) => {
            console.error('FileReader error', err);
            alert('Unable to load image');
        };

        reader.readAsDataURL(file);
    }


    // Wire up UI
    document.getElementById('start-btn').addEventListener('click', async(ev) => {


        ev.target.disabled = true;
        document.getElementById('status').textContent = 'Loading model...';
        try {
            await init();
        } catch (err) {
            console.error(err);
            document.getElementById('status').textContent = 'Error loading model';
        }
    });

    document.getElementById('toggle-btn').addEventListener('click', toggleWebcam);
    document.getElementById('predict-btn').addEventListener('click', predictOnce);
    document.getElementById('snapshot-btn').addEventListener('click', takeSnapshot);
    document.getElementById('upload-img').addEventListener('change', handleUpload);

    //BY elmghari abdelhamid