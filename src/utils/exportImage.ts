import { toJpeg, toPng } from 'html-to-image';
import download from 'downloadjs';

export async function exportElementAsJpg(elementId: string, filename: string): Promise<boolean> {
  const node = document.getElementById(elementId);
  if (!node) {
    console.error(`Element #${elementId} not found`);
    return false;
  }

  try {
    const dataUrl = await toJpeg(node, {
      quality: 0.95,
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      style: {
        borderRadius: '0px',
        boxShadow: 'none',
      }
    });

    const safeFilename = filename.endsWith('.jpg') ? filename : `${filename}.jpg`;
    download(dataUrl, safeFilename, 'image/jpeg');
    return true;
  } catch (error) {
    console.error('Error generating JPG image:', error);
    throw error;
  }
}

export async function exportElementAsPng(node: HTMLElement, filename: string): Promise<boolean> {
  try {
    const dataUrl = await toPng(node, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      style: {
        borderRadius: '0px',
        boxShadow: 'none',
      }
    });

    const safeFilename = filename.endsWith('.png') ? filename : `${filename}.png`;
    download(dataUrl, safeFilename, 'image/png');
    return true;
  } catch (error) {
    console.error('Error generating PNG image:', error);
    throw error;
  }
}

export function printElement(): void {
  const originalTitle = document.title;
  window.print();
  document.title = originalTitle;
}
