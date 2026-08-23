from PIL import Image, ImageDraw, ImageFont
import math

SIZE = 128
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Rounded square background (VS Code style)
bg = (36, 41, 47, 255)  # dark slate
r = 24
d.rounded_rectangle([4, 4, SIZE - 4, SIZE - 4], radius=r, fill=bg)

# Speech bubble (lighter panel)
bubble = (88, 166, 255, 255)  # accent blue
bx0, by0, bx1, by1 = 22, 20, 106, 78
d.rounded_rectangle([bx0, by0, bx1, by1], radius=14, fill=bubble)

# Bubble tail (pointing bottom-left for RTL feel)
d.polygon([(bx0 + 14, by1), (bx0 + 14, by1 + 18), (bx0 + 34, by1)], fill=bubble)

# Three text lines inside bubble (white)
line = (255, 255, 255, 255)
for i, (lx0, lx1) in enumerate([(34, 94), (34, 80), (34, 66)]):
    ly = 34 + i * 13
    d.rounded_rectangle([lx0, ly, lx1, ly + 6], radius=3, fill=line)

# RTL arrow (right-to-left) below bubble
arrow_y = 96
d.line([(96, arrow_y), (32, arrow_y)], fill=(255, 255, 255, 255), width=6)
# arrow head pointing left
d.polygon([(32, arrow_y), (46, arrow_y - 9), (46, arrow_y + 9)], fill=(255, 255, 255, 255))

img.save(r"c:\Nabi\vscode-copilot-rtl\icon.png")
print("saved icon.png", img.size)
