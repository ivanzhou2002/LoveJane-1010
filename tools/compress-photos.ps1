# 实拍照片原地重压：限宽 1280px、JPG 质量 78（文件名不变，引用不断）
# 用法：powershell -File tools/compress-photos.ps1
Add-Type -AssemblyName System.Drawing

$files = Get-ChildItem photos -File | Where-Object { $_.Extension -match '^\.jpe?g$' }
$before = ($files | Measure-Object Length -Sum).Sum
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'

foreach ($f in $files) {
  $img = [System.Drawing.Image]::FromFile($f.FullName)
  try {
    # EXIF 方向烘焙进像素，避免压完横竖颠倒
    $exif = $img.GetPropertyItem(0x0112)
    $orient = if ($exif) { $exif.Value[0] } else { 1 }
    switch ($orient) {
      2 { $img.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX) }
      3 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
      4 { $img.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipY) }
      5 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipX) }
      6 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
      7 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipX) }
      8 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
    }
    $w = $img.Width; $h = $img.Height
    $maxW = 1280
    if ($w -gt $maxW) {
      $nw = $maxW; $nh = [int]($h * $maxW / $w)
      $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.DrawImage($img, 0, 0, $nw, $nh)
      $g.Dispose()
    } else {
      $bmp = New-Object System.Drawing.Bitmap($img)
    }
    $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]78)
    $tmp = $f.FullName + '.tmp'
    $bmp.Save($tmp, $codec, $ep)
    $bmp.Dispose()
  } finally { $img.Dispose() }
  Move-Item $tmp $f.FullName -Force
}

$after = (Get-ChildItem photos -File | Where-Object { $_.Extension -match '^\.jpe?g$' } | Measure-Object Length -Sum).Sum
"{0} 张：{1:N1} MB -> {2:N1} MB" -f $files.Count, ($before/1MB), ($after/1MB)
