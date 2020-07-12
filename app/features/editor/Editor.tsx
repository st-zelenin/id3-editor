/* eslint-disable jsx-a11y/label-has-associated-control */
import * as base64 from 'byte-base64';
import { ipcRenderer, remote } from 'electron';
import { Tags } from 'node-id3';
import React, { ChangeEvent, useState } from 'react';
import ReactCrop, { Crop } from 'react-image-crop';

import styles from './Editor.css';

// import { Link } from 'react-router-dom';

const DEFAULT_IMAGE_TYPE = 'data:image/png;base64,';

function getCroppedImageBuffer(image: HTMLImageElement, crop: Crop) {
  const { width, height, x = 0, y = 0 } = crop;

  if (!width || !height) {
    throw new Error(`crop selection is empty: ${crop}`);
  }

  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx?.drawImage(
    image,
    x * scaleX,
    y * scaleY,
    width * scaleX,
    height * scaleY,
    0,
    0,
    width,
    height
  );

  const encodedImage = canvas.toDataURL().slice(DEFAULT_IMAGE_TYPE.length);

  return Buffer.from(encodedImage, 'base64');
}

async function openFile(
  setFile: (x: string[]) => void,
  setTags: (x: Tags) => void,
  setCover: (x: string) => void
) {
  const result = remote.dialog.showOpenDialogSync({
    properties: ['openFile'],
    filters: [{ name: 'mp3', extensions: ['mp3'] }],
  });

  if (result && result.length) {
    const originalTags: Tags = await ipcRenderer.sendSync(
      'read-tags',
      result[0]
    );

    const tags: Tags = {
      artist: originalTags.artist,
      title: originalTags.title,
      genre: originalTags.genre,
      album: originalTags.album,
    };

    console.log('tags', originalTags);

    setTags(tags);
    setFile(result as string[]);

    if (originalTags.image && originalTags.image.imageBuffer) {
      const coverSrc = `${DEFAULT_IMAGE_TYPE}${base64.bytesToBase64(
        originalTags.image.imageBuffer
      )}`;
      setCover(coverSrc);
    }
  }
}

async function selectCover(
  setNewCover: (x: string) => void,
  setIsCoverChanged: (x: boolean) => void
) {
  const result = remote.dialog.showOpenDialogSync({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }],
  });

  if (result && result.length) {
    setNewCover(result[0]);
    setIsCoverChanged(true);
  }
}

async function updateTags(
  filePath: string,
  tags: Tags,
  image: HTMLImageElement,
  crop: Crop,
  isCoverChanged: boolean
) {
  if (!filePath) {
    return;
  }

  if (image && crop && isCoverChanged) {
    const imageBuffer = await getCroppedImageBuffer(image, crop);

    tags.image = {
      mime: '',
      imageBuffer,
      type: {
        id: 3,
        name: 'front cover',
      },
      description: '',
    };
  }

  console.log('updated tags:', tags);

  await ipcRenderer.sendSync('update-tags', {
    file: filePath,
    tags,
  });
}

function onImageLoaded(
  image: HTMLImageElement,
  setCrop: (x: Crop) => void,
  setImage: (x: HTMLImageElement) => void
) {
  const { width, height } = image;
  if (height > width) {
    const cropSize = width * 0.8;
    const x = (width - cropSize) / 2;
    const y = (height - cropSize) / 2;

    setCrop({ aspect: 1, width: cropSize, x, y });
  } else {
    const cropSize = height * 0.8;
    const x = (width - cropSize) / 2;
    const y = (height - cropSize) / 2;

    setCrop({ aspect: 1, height: cropSize, x, y });
  }

  setImage(image);

  // required by `react-image-crop` api:
  // return `false` if crop is set in `onImageLoaded`
  return false;
}

export default function Editor() {
  const [file, setFile] = useState(['']);
  const [tags, setTags] = useState<Tags>({});
  const [cover, setCover] = useState<string>('');
  const [newCover, setNewCover] = useState<string>('');
  const [crop, setCrop] = useState<Crop>({});
  const [image, setImage] = useState<HTMLImageElement>();
  const [isCoverChanged, setIsCoverChanged] = useState<boolean>(false);

  const fileName = file.length
    ? file[0].substring(file[0].lastIndexOf('/') + 1)
    : '';

  const handleChange = ({ target }: ChangeEvent<HTMLInputElement>) => {
    if (!target) {
      return;
    }

    const { name: inputName, value } = target;

    setTags({ ...tags, [inputName]: value });
  };

  return (
    <div>
      <form className={styles.form}>
        <div>
          <button
            onClick={() => {
              openFile(setFile, setTags, setCover);
            }}
            type="button"
          >
            <i className="fa fa-plus"> open .mp3</i>
          </button>

          <span>{fileName}</span>
        </div>

        <label>
          Artist
          <input
            type="text"
            name="artist"
            value={tags.artist}
            onChange={handleChange}
          />
        </label>
        <label>
          Title
          <input
            type="text"
            name="title"
            value={tags.title}
            onChange={handleChange}
          />
        </label>
        <label>
          Genre
          <input
            type="text"
            name="genre"
            value={tags.genre}
            onChange={handleChange}
          />
        </label>
        <label>
          Album
          <input
            type="text"
            name="album"
            value={tags.album}
            onChange={handleChange}
          />
        </label>

        <button
          className={styles.btn}
          onClick={() => {
            selectCover(setNewCover, setIsCoverChanged);
          }}
          data-tclass="btn"
          type="button"
        >
          <i className="fa fa-image"> open image</i>
        </button>
        <button
          onClick={() => {
            if (image) {
              updateTags(file[0], tags, image, crop, isCoverChanged);
            }
          }}
          type="button"
        >
          <i className="fa fa-save"> save tags</i>
        </button>
      </form>
      <div className={styles.cover}>
        <ReactCrop
          src={newCover || cover}
          crop={crop}
          onChange={(newCrop) => setCrop(newCrop)}
          keepSelection
          imageStyle={{ maxHeight: '90vh' }}
          onImageLoaded={(img: HTMLImageElement) => {
            return onImageLoaded(img, setCrop, setImage);
          }}
        />
      </div>
    </div>
  );
}
