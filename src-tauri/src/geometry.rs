//! Pure geometry helpers for window placement (physical pixels).

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Top-left position that puts a window of `size` in the bottom-right
/// corner of `area`, leaving `gap` pixels to the right and bottom edges.
/// Clamps to the area's top-left when the window is larger than the area.
pub fn bottom_right(area: Rect, size: (u32, u32), gap: u32) -> (i32, i32) {
    let right = i64::from(area.x) + i64::from(area.width);
    let bottom = i64::from(area.y) + i64::from(area.height);
    let x = (right - i64::from(size.0) - i64::from(gap)).max(i64::from(area.x));
    let y = (bottom - i64::from(size.1) - i64::from(gap)).max(i64::from(area.y));
    (x as i32, y as i32)
}

#[cfg(test)]
mod tests {
    use super::*;

    const AREA: Rect = Rect {
        x: 0,
        y: 25,
        width: 1440,
        height: 875,
    };

    #[test]
    fn places_window_in_bottom_right_with_gap() {
        assert_eq!(
            bottom_right(AREA, (260, 56), 24),
            (1440 - 260 - 24, 900 - 56 - 24)
        );
    }

    #[test]
    fn respects_area_offset_on_secondary_layout() {
        let area = Rect {
            x: -1920,
            y: 0,
            width: 1920,
            height: 1040,
        };
        assert_eq!(bottom_right(area, (100, 100), 10), (-110, 930));
    }

    #[test]
    fn clamps_when_window_is_larger_than_area() {
        assert_eq!(bottom_right(AREA, (2000, 2000), 24), (0, 25));
    }
}
