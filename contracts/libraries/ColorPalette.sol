// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @title ColorPalette - DB32 color palette definitions and validation
/// @notice Provides the DawnBringer 32 palette for pixel art canvases
/// @dev Index 0 = empty/unpainted pixel. Indices 1-32 = DB32 palette colors.
library ColorPalette {

    /// @notice Maximum valid color index
    uint8 internal constant MAX_COLOR_INDEX = 32;

    /// @notice Check if a color index is valid (1-32)
    /// @param colorIndex The color index to validate
    /// @return True if the color index is within the valid range
    function isValidColor(uint8 colorIndex) internal pure returns (bool) {
        return colorIndex >= 1 && colorIndex <= MAX_COLOR_INDEX;
    }

    /// @notice Get the RGB value for a color index
    /// @param colorIndex The color index (0-32)
    /// @return The 24-bit RGB value
    function getColor(uint8 colorIndex) internal pure returns (uint24) {
        // DB32 palette: index 0 = empty (black), indices 1-32 = DawnBringer 32 colors
        if (colorIndex == 0) return 0x000000;
        if (colorIndex == 1) return 0x222034;
        if (colorIndex == 2) return 0x45283C;
        if (colorIndex == 3) return 0x663931;
        if (colorIndex == 4) return 0x8F563B;
        if (colorIndex == 5) return 0xDF7126;
        if (colorIndex == 6) return 0xD9A066;
        if (colorIndex == 7) return 0xEEC39A;
        if (colorIndex == 8) return 0xFBF236;
        if (colorIndex == 9) return 0x99E550;
        if (colorIndex == 10) return 0x6ABE30;
        if (colorIndex == 11) return 0x37946E;
        if (colorIndex == 12) return 0x4B692F;
        if (colorIndex == 13) return 0x524B24;
        if (colorIndex == 14) return 0x323C39;
        if (colorIndex == 15) return 0x3F3F74;
        if (colorIndex == 16) return 0x306082;
        if (colorIndex == 17) return 0x5B6EE1;
        if (colorIndex == 18) return 0x639BFF;
        if (colorIndex == 19) return 0x5FCDE4;
        if (colorIndex == 20) return 0xCBDBFC;
        if (colorIndex == 21) return 0xFFFFFF;
        if (colorIndex == 22) return 0x9BADB7;
        if (colorIndex == 23) return 0x847E87;
        if (colorIndex == 24) return 0x696A6A;
        if (colorIndex == 25) return 0x595652;
        if (colorIndex == 26) return 0x76428A;
        if (colorIndex == 27) return 0xAC3232;
        if (colorIndex == 28) return 0xD95763;
        if (colorIndex == 29) return 0xD77BBA;
        if (colorIndex == 30) return 0x8F974A;
        if (colorIndex == 31) return 0x8A6F30;
        if (colorIndex == 32) return 0x000000; // DB32 last color (duplicate black for index 32)

        return 0x000000; // fallback
    }
}
