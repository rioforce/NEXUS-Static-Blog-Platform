# NEXUS Static Blog Platform

A blogging platform for us who want to use GitHub pages as a blog.

This platform uses Markdown for the body content, and dynamically loading site elements (header, footer, sidebar) so if you want to update the whole website, you only have to do it once! A much needed improvement over copy-pasting code in every single file.

It's still a work in process, but the bones are good.

Currently it looks a lot like YouTube, and that's because it's designed for both Video and Blog content. Let's run through how to set up a new blog post:

##Setting up a new blog post

- Make a copy of the `post` folder.
- The `postinfo.json` file contains your title, embedded YouTube video or Featured Image, plus the author's name, and the publication date. It also contains a reference to where the post content is.
- The post content is found in the content.md file. Write your blog post using Markdown, HTML, or a combination of both.
- Nothing needs to be modified in index.html. Only modify this if you have to change the website structure. The rest of the content of the page (header, footer, sidebar) comes in through files in the `templates` folder.

Be sure to add your new blog post to the list of blog posts (currently randomly shuffled, but that's changable) using what's currently called `recommended-videos.json`.

##TODO
This is a work in progress. I still have these things to do.

- Make a homepage featuring the post list
- Make the post list shuffle or not shuffle easier
- Continue to rename files to remove "video" references, since this is now a blog platform primarily.
- Revamp the whole website design to be less YouTube style and more blog style.
- Add more to the footer
- Maybe one day I can have a static front end that you can run on your computer or online that will generate all these files for you just by you inputting the information.
