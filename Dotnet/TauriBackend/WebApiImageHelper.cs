using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using Color = SixLabors.ImageSharp.Color;
using Image = SixLabors.ImageSharp.Image;
using Point = SixLabors.ImageSharp.Point;
using Rectangle = SixLabors.ImageSharp.Rectangle;
using Size = SixLabors.ImageSharp.Size;

namespace VRCX.TauriBackend;

/// <summary>
/// Image resize/crop helpers ported from the master branch's AppApi ImageSaving,
/// used by WebApi image uploads. Only the methods required by WebApi are kept.
/// </summary>
public static class WebApiImageHelper
{
    public static byte[] ResizeImageToFitLimits(byte[] imageData, bool matchingDimensions, int maxWidth = 2000,
        int maxHeight = 2000, long maxSize = 10_000_000)
    {
        using var fileMemoryStream = new MemoryStream(imageData);
        var image = Image.Load(fileMemoryStream);

        if (image.Width > maxWidth)
        {
            var sizingFactor = image.Width / (double)maxWidth;
            var newHeight = (int)Math.Round(image.Height / sizingFactor);
            image.Mutate(x => x.Resize(maxWidth, newHeight));
        }
        if (image.Height > maxHeight)
        {
            var sizingFactor = image.Height / (double)maxHeight;
            var newWidth = (int)Math.Round(image.Width / sizingFactor);
            image.Mutate(x => x.Resize(newWidth, maxHeight));
        }
        if (matchingDimensions && image.Width != image.Height)
        {
            var targetSize = Math.Max(image.Width, image.Height);
            var squareCanvas = new Image<Rgba32>(targetSize, targetSize);
            var xOffset = (targetSize - image.Width) / 2;
            var yOffset = (targetSize - image.Height) / 2;
            squareCanvas.Mutate(x =>
                x.DrawImage(image, new Point(xOffset, yOffset), 1f));
            image = squareCanvas;
        }

        SaveToFileToUpload();
        for (var i = 0; i < 250 && imageData.Length > maxSize; i++)
        {
            SaveToFileToUpload();
            if (imageData.Length < maxSize)
                break;

            int newWidth;
            int newHeight;
            if (image.Width > image.Height)
            {
                newWidth = image.Width - 25;
                newHeight = (int)Math.Round(image.Height / (image.Width / (double)newWidth));
            }
            else
            {
                newHeight = image.Height - 25;
                newWidth = (int)Math.Round(image.Width / (image.Height / (double)newHeight));
            }

            image.Mutate(x => x.Resize(newWidth, newHeight));
        }

        if (imageData.Length > maxSize)
        {
            throw new Exception("Failed to get image into target filesize.");
        }

        image.Dispose();
        return imageData;

        void SaveToFileToUpload()
        {
            using var imageSaveMemoryStream = new MemoryStream();
            image.SaveAsPng(imageSaveMemoryStream);
            imageData = imageSaveMemoryStream.ToArray();
        }
    }

    public static byte[] ResizePrintImage(byte[] imageData)
    {
        const int desiredWidth = 1920;
        const int desiredHeight = 1080;

        using var fileMemoryStream = new MemoryStream(imageData);
        var image = Image.Load(fileMemoryStream);

        if (image.Height > image.Width)
            image.Mutate(x => x.Rotate(RotateMode.Rotate270));

        // increase size to 1920x1080
        if (image.Width < desiredWidth || image.Height < desiredHeight)
        {
            const double expectedAspectRatio = 1920.0 / 1080.0;
            var target = new Image<Rgba32>(1920, 1080);
            var aspectRatio = (double)image.Width / image.Height;
            int width, height, xOffset, yOffset;

            if (aspectRatio > expectedAspectRatio)
            {
                // Image is wider than 16:9 - scale based on width
                width = 1920;
                height = (int)(width / aspectRatio);
                xOffset = 0;
                yOffset = (1080 - height) / 2;
            }
            else
            {
                // Image is taller than 16:9 - scale based on height
                height = 1080;
                width = (int)(height * aspectRatio);
                xOffset = (1920 - width) / 2;
                yOffset = 0;
            }
            using var scaledImage = image.Clone(ctx => ctx.Resize(width, height));
            target.Mutate(x => x.Fill(Color.White)
                .DrawImage(scaledImage, new Point(xOffset, yOffset), 1f));
            image = target;
        }

        // limit size to 1920x1080
        if (image.Width > desiredWidth)
        {
            var sizingFactor = image.Width / (double)desiredWidth;
            var newHeight = (int)Math.Round(image.Height / sizingFactor);
            image.Mutate(x => x.Resize(desiredWidth, newHeight));
        }
        if (image.Height > desiredHeight)
        {
            var sizingFactor = image.Height / (double)desiredHeight;
            var newWidth = (int)Math.Round(image.Width / sizingFactor);
            image.Mutate(x => x.Resize(newWidth, desiredHeight));
        }

        // add white border
        const int xBorderOffset = 64; // 2048 / 32
        const int yBorderOffset = 69; // 1440 / 20.869
        using Image<Rgba32> newImage = new(2048, 1440);
        newImage.Mutate(x => x.Fill(Color.White));
        var newX = (2048 - image.Width) / 2;
        var borderPoint = new Point(newX, yBorderOffset);
        newImage.Mutate(x => x.DrawImage(image, borderPoint, 1f));
        using var imageSaveMemoryStream = new MemoryStream();
        newImage.SaveAsPng(imageSaveMemoryStream);
        return imageSaveMemoryStream.ToArray();
    }

    public static bool CropPrint(ref Image image)
    {
        if (image.Width != 2048 || image.Height != 1440)
            return false;

        var point = new Point(64, 69);
        var size = new Size(1920, 1080);
        var rectangle = new Rectangle(point, size);
        image.Mutate(x => x.Crop(rectangle));
        return true;
    }
}
