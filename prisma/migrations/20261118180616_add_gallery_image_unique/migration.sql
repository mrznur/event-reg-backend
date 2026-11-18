/*
  Warnings:

  - A unique constraint covering the columns `[title,url]` on the table `GalleryImage` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "GalleryImage_title_url_key" ON "GalleryImage"("title", "url");
