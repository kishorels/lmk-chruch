import { useEffect, useState, useRef } from "react";

export default function PresentationWindow() {
    const [text, setText] = useState("");
    const [blackout, setBlackout] = useState(false);
    const [template, setTemplate] = useState(null);
    const videoRef = useRef(null);

    useEffect(() => {
        window.electronAPI.onPresent((data) => {
            if (data.type === "present") {
                setBlackout(false);
                setText(data.text);
                if (data.template) {
                    setTemplate(data.template);
                }
            }

            if (data.type === "clear") {
                setText("");
                setBlackout(false);
            }

            if (data.type === "blackout") {
                setText("");
                setBlackout(true);
            }
        });
    }, []);

    // Restart video when template changes
    useEffect(() => {
        if (videoRef.current && template?.background_type === 'video') {
            videoRef.current.play().catch(console.error);
        }
    }, [template]);

    if (blackout) {
        return <div className="presentation-blackout" />;
    }

    const textStyle = {
        fontFamily: template?.font_family || 'Inter, sans-serif',
        fontSize: `${template?.font_size || 72}px`,
        color: template?.font_color || '#ffffff',
        textAlign: template?.text_align || 'center',
        textShadow: template?.text_shadow || '3px 3px 12px rgba(0, 0, 0, 0.8)',
        lineHeight: 1.4,
        whiteSpace: 'pre-wrap',
        maxWidth: '90%',
        position: 'relative',
        zIndex: 2
    };

    const renderBackground = () => {
        if (!template) {
            return (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    }}
                />
            );
        }

        if (template.background_type === 'video') {
            return (
                <>
                    <video
                        ref={videoRef}
                        src={template.dataUrl || ''}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            zIndex: 0
                        }}
                        autoPlay
                        muted
                        loop
                        playsInline
                    />
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: template.background_overlay || 'rgba(0,0,0,0.3)',
                            zIndex: 1
                        }}
                    />
                </>
            );
        }

        if (template.background_type === 'image') {
            return (
                <>
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundImage: template.dataUrl ? `url('${template.dataUrl}')` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            zIndex: 0
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: template.background_overlay || 'rgba(0,0,0,0.3)',
                            zIndex: 1
                        }}
                    />
                </>
            );
        }

        // Gradient background
        return (
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: template.background_value || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    zIndex: 0
                }}
            />
        );
    };

    return (
        <div
            className="presentation-container"
            style={{
                position: 'relative',
                overflow: 'hidden',
                background: '#000'
            }}
        >
            {renderBackground()}

            {text && (
                <div style={textStyle}>
                    {text}
                </div>
            )}
        </div>
    );
}
