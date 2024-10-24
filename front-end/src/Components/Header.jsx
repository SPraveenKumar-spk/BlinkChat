import React from "react";
import logo from "../assets/logo.svg";

const Header = () => {
  return (
    <nav
      className="navbar navbar-expand-lg navbar-light bg-light"
      style={{ height: "10vh" }}
    >
      <div className="ms-5">
        <img
          className="img"
          src={logo}
          alt="logo"
          style={{ width: "3rem", marginRight: "1rem" }}
        />
        <a className="navbar-brand" href="#">
          BlinkChat
        </a>
      </div>
    </nav>
  );
};

export default Header;
