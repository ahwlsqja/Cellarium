// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @title PixelStorage - Bitpacked pixel storage library
/// @notice Packs 32 color indices (uint8) into each uint256 slot
/// @dev For a WxH canvas, total slots needed = ceil(W * H / 32)
///      Pixel at (x, y) with width W:
///        linearIndex = y * W + x
///        slotIndex = linearIndex / 32
///        bitOffset = (linearIndex % 32) * 8
library PixelStorage {

    /// @notice Get the color index of a pixel at (x, y)
    /// @param slots The storage array of bitpacked pixel data
    /// @param width The canvas width
    /// @param x The x coordinate
    /// @param y The y coordinate
    /// @return The color index (0 = empty, 1-32 = painted)
    function getPixel(
        uint256[] storage slots,
        uint16 width,
        uint16 x,
        uint16 y
    ) internal view returns (uint8) {
        uint256 linearIndex = uint256(y) * uint256(width) + uint256(x);
        uint256 slotIndex = linearIndex / 32;
        uint256 bitOffset = (linearIndex % 32) * 8;
        return uint8((slots[slotIndex] >> bitOffset) & 0xFF);
    }

    /// @notice Set the color index of a pixel at (x, y)
    /// @param slots The storage array of bitpacked pixel data
    /// @param width The canvas width
    /// @param x The x coordinate
    /// @param y The y coordinate
    /// @param colorIndex The new color index (1-32)
    /// @return previousColor The previous color index at this position
    function setPixel(
        uint256[] storage slots,
        uint16 width,
        uint16 x,
        uint16 y,
        uint8 colorIndex
    ) internal returns (uint8 previousColor) {
        uint256 linearIndex = uint256(y) * uint256(width) + uint256(x);
        uint256 slotIndex = linearIndex / 32;
        uint256 bitOffset = (linearIndex % 32) * 8;

        uint256 slot = slots[slotIndex];
        previousColor = uint8((slot >> bitOffset) & 0xFF);

        // Clear the 8 bits and set new value
        slot = (slot & ~(uint256(0xFF) << bitOffset)) | (uint256(colorIndex) << bitOffset);
        slots[slotIndex] = slot;
    }
}
