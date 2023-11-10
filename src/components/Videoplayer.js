import React, { useState, useRef, useEffect } from 'react';
import './VideoPlayer.css';
import WaveSurfer from 'wavesurfer.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause } from '@fortawesome/free-solid-svg-icons';

const VideoPlayer = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [videoMetadata, setVideoMetadata] = useState(null);
    const [hasAudio, setHasAudio] = useState(false);
    const wavesurferRef = useRef(null);
    const [videoSrc, setVideoSrc] = useState(null);
    const fileSelectUserRef = useRef(null);




    useEffect(() => {
        videoRef.current = document.createElement("video");
        wavesurferRef.current = WaveSurfer.create({
            container: "#waveform",
            waveColor: "violet",
            progressColor: "purple",
            backend: "MediaElement",
        });

        wavesurferRef.current.on("seek", (progress) => {
            if (videoRef.current) {
                const newTime = videoRef.current.duration * progress;
                videoRef.current.currentTime = newTime;
            }
        });

        return () => {
            if (videoRef.current) {
                URL.revokeObjectURL(videoRef.current.src);
                videoRef.current = null;
            }
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
            }
        };
    }, []);

    const handleVideoSelect = async (event) => {
        const file = event.target.files[0];

        if (!file) {
            return;
        }

        const url = URL.createObjectURL(file);
        // console.log("Here is the file", url);

        const video = videoRef.current;
        video.src = url;
        setVideoSrc(url);

        const initializeAudioContext = () => {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaElementSource(video);
            const analyser = audioContext.createAnalyser();
            const gainNode = audioContext.createGain();

            gainNode.gain.value = 0;

            source.connect(analyser);
            analyser.connect(gainNode);
            gainNode.connect(audioContext.destination);

            analyser.fftSize = 2048;

            return { audioContext, analyser, gainNode };
        };

        const checkForAudio = () => {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((a, value) => a + value, 0);
            return sum > 0;
        };

        const { audioContext, analyser, gainNode } = initializeAudioContext();
        let audioPres = false;

        video.addEventListener("timeupdate", () => {
            if (!audioPres) {
                if (checkForAudio()) {
                    console.log("video has audio");
                    audioPres = true;
                } else {
                    console.log("video doesn't have audio");
                }
            }
        });

        video.play();

        setTimeout(() => {
            video.pause();

            if (audioPres) {
                gainNode.gain.value = 1;
                video.currentTime = 0;
                video.addEventListener("seeked", function drawThumbnail() {
                    drawVideoFrame();
                    video.pause();
                    video.removeEventListener("seeked", drawThumbnail);
                });

                setVideoMetadata({
                    duration: video.duration,
                    height: video.videoHeight,
                    width: video.videoWidth,
                    aspectRatio: video.videoWidth / video.videoHeight,
                    range: `${video.seekable.start(0)} - ${video.seekable.end(0).toFixed(2)}`,
                });
            } else {
                alert("The uploaded video has no Audio. Please try another.");
                window.location.reload();
            }
        }, 2000);

        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            if (audioBuffer.numberOfChannels === 0) {
                URL.revokeObjectURL(url);
                setVideoSrc(null);
                return;
            }
        } catch (error) {
            console.error("Error fetching or decoding audio data:", error);
        }
    };


    console.log(isPlaying)
    const drawVideoFrame = () => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!isPlaying) {
            const ctx = canvasRef.current.getContext("2d");
            ctx.drawImage(
                videoRef.current,
                0,
                0,
                canvasRef.current.width,
                canvasRef.current.height,
            );
        }
        if (canvas && video) {
            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            if (!video.paused && !video.ended) {
                requestAnimationFrame(drawVideoFrame);
            }
        }
    };

    const togglePlayPause = () => {
        const video = videoRef.current;
        if (video.paused || video.ended) {
            setIsPlaying(true);
            video.play();
            drawVideoFrame();
        } else {
            setIsPlaying(false);
            video.pause();
        }
    };

    useEffect(() => {
        if (videoSrc) {
            wavesurferRef.current.load(videoSrc);
        }
    }, [videoSrc]);

    useEffect(() => {
        const video = videoRef.current;
        if (videoRef.current) {
            const onTimeUpdate = () => {
                const currentTime = video.currentTime;
                const duration = video.duration;
                const progress = currentTime / duration;
                wavesurferRef.current.seekTo(progress);
                setVideoMetadata((prevMdata) => ({ ...prevMdata, currentTime }));
            };
            video.addEventListener("timeupdate", onTimeUpdate);
            return () => video.removeEventListener("timeupdate", onTimeUpdate);
        }
    }, [videoSrc]);

    return (
        <div className="app">
            <div className="input_container">
                <input type="file" accept="video/*" onChange={handleVideoSelect} />
            </div>
            <div className='video'>
                
                <div className="video-container">
                    <canvas
                        ref={canvasRef}
                        width="640"
                        height="360"
                        onClick={togglePlayPause}
                    />
                    <div
                        id="waveform"
                        style={{
                            marginTop: "15px",
                            width: "100%",
                        }}
                    />
                    <p
                        style={{
                            position: "absolute",
                            top: 0,
                            left: "10px",
                            color: "#868686",
                            zIndex: -1,
                        }}
                    >
                        Audio Waveform
                    </p>
                    {isPlaying ? (
                        <FontAwesomeIcon
                            icon={faPause}
                            size="3x"
                            color="#ffffff"
                            onClick={togglePlayPause}
                            style={{
                                position: "absolute",
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                                zIndex: 1,
                            }}
                        />
                    ) : (
                        <FontAwesomeIcon
                            icon={faPlay}
                            size="3x"
                            color="#ffffff"
                            onClick={togglePlayPause}
                            style={{
                                position: "absolute",
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                                zIndex: 1,
                            }}
                        />
                    )}
                </div>
                {videoMetadata && (
                    <div className='meta-container'>
                        <h2>Video Metadata</h2>
                        <div>
                            Duration: {videoMetadata.duration} sec<br />
                            Height: {videoMetadata.height}<br />
                            Width: {videoMetadata.width}<br />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoPlayer;
