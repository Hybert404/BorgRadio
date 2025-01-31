const generateHexColor = () => {
    const hue = Math.floor(Math.random() * 360); // Random hue between 0-360
    const saturation = Math.floor(Math.random() * (80 - 60) + 60); // 60-80% saturation for vibrancy
    const lightness = Math.floor(Math.random() * (70 - 55) + 55); // 55-70% lightness for good contrast

    return hslToHex(hue, saturation, lightness);
};

const hslToHex = (h, s, l) => {
    s /= 100;
    l /= 100;

    const f = (n) => {
        const k = (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const color = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(255 * color)
        .toString(16)
        .padStart(2, "0"); // Convert to HEX and ensure 2 digits
    };

    return `#${f(0)}${f(8)}${f(4)}`;
};

module.exports = generateHexColor;