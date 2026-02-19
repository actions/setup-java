package build
import mill._, scalalib._

object MyProject extends ScalaModule {
    def scalaVersion = "2.13.11"
    def ivyDeps = Agg(ivy"com.lihaoyi::mainargs:0.6.2")

    object test extends ScalaTests {
        def ivyDeps = Agg(ivy"com.lihaoyi::utest:0.8.5")
        def testFramework = "utest.runner.Framework"
    }
}
