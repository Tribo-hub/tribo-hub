export type Embed = { kind: 'iframe' | 'video'; src: string };

function youtubeId(url: string): string {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
  return m ? m[1] : url;
}

export function embed(tipoVideo: string, videoUrl: string): Embed {
  if (tipoVideo === 'youtube') {
    return { kind: 'iframe', src: `https://www.youtube.com/embed/${youtubeId(videoUrl)}` };
  }
  if (tipoVideo === 'vimeo') {
    const id = videoUrl.match(/(\d+)/)?.[1] ?? '';
    return { kind: 'iframe', src: `https://player.vimeo.com/video/${id}` };
  }
  // upload: a API já devolve uma URL assinada direta para o arquivo
  return { kind: 'video', src: videoUrl };
}
